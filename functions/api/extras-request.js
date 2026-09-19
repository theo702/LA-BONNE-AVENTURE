// POST /api/extras-request — demande d'extra (arrivée anticipée / départ tardif / pack)
// avec validation hôte + ménage avant paiement.
import {
  getExtra, createExtraOrder, getExtraPromotion, listExtraPromotions,
  createExtraActionToken, ensurePricingSchema,
} from '../_lib/db.js';
import { extraAvailable, extraAvailableBoth } from '../_lib/extraAvail.js';
import { sendExtraApprovalRequest, sendExtraRequestAck } from '../_lib/notify.js';

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function todayYmd() { return new Date().toISOString().slice(0, 10); }
function isLivePromo(p) {
  if (!p || !p.active) return false;
  const t = todayYmd();
  return p.valid_from <= t && p.valid_to >= t;
}
function matchesTarget(promo, kind) {
  const t = promo.target || 'all';
  return t === 'all' || t === kind;
}

export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  if (!name) return Response.json({ ok: false, error: 'name', message: 'Nom requis.' }, { status: 400 });
  if (!isEmail(email)) return Response.json({ ok: false, error: 'email', message: 'Email invalide.' }, { status: 400 });

  const currency = 'eur';
  const origin = env.SITE_URL || new URL(request.url).origin;
  const returnPath = (body.return_path || '/extras').toString();
  const promoId = body.promo_id ? parseInt(body.promo_id, 10) : 0;
  const isPack = body.kind === 'flex_pack' || String(body.extra_id || '').startsWith('pack:');
  const isBoth = !isPack && body.kind === 'both';

  let primaryId = null;
  let groupId = crypto.randomUUID();
  let summaryTitle = '';
  let summaryAmount = 0;
  let summaryDates = '';
  const orderIds = [];

  // ---------- Pack flexibilité ----------
  if (isPack) {
    const promo = promoId ? await getExtraPromotion(env, promoId) : null;
    if (!promo || promo.kind !== 'pack_flex' || !isLivePromo(promo)) {
      return Response.json({ ok: false, message: 'Offre pack indisponible.' }, { status: 404 });
    }
    const earlyDate = (body.early_date || body.date_early || '').toString().trim();
    const lateDate = (body.late_date || body.date_late || '').toString().trim();
    const avEarly = await extraAvailable(env, 'early_checkin', earlyDate);
    if (!avEarly.available) {
      return Response.json({ ok: false, error: 'unavailable', message: avEarly.message || 'Arrivée anticipée indisponible.' }, { status: 409 });
    }
    const avLate = await extraAvailable(env, 'late_checkout', lateDate);
    if (!avLate.available) {
      return Response.json({ ok: false, error: 'unavailable', message: avLate.message || 'Départ tardif indisponible.' }, { status: 409 });
    }
    const amount = Math.max(0, Math.round(Number(promo.pack_price_cents) || 1500));
    const title = promo.title || 'Pack flexibilité';
    const { id: paidId } = await createExtraOrder(env, {
      extra_id: null, title: title + ' — Départ tardif',
      amount_cents: amount, currency, guest_name: name, email,
      kind: 'late_checkout', service_date: lateDate,
      status: 'requested', group_id: groupId,
    });
    const { id: freeId } = await createExtraOrder(env, {
      extra_id: null, title: title + ' — Arrivée anticipée (offerte)',
      amount_cents: 0, currency, guest_name: name, email,
      kind: 'early_checkin', service_date: earlyDate,
      status: 'requested', group_id: groupId,
    });
    primaryId = paidId;
    orderIds.push(paidId, freeId);
    summaryTitle = title;
    summaryAmount = amount;
    summaryDates = `Départ tardif ${lateDate} · Arrivée anticipée ${earlyDate}`;
  } else if (isBoth) {
    const extra = await getExtra(env, parseInt(body.extra_id, 10));
    if (!extra || !extra.active || extra.kind !== 'both') {
      return Response.json({ ok: false, message: 'Extra indisponible.' }, { status: 404 });
    }
    const lateDate = (body.late_date || '').toString().trim();
    const earlyDate = (body.early_date || '').toString().trim();
    const av = await extraAvailableBoth(env, lateDate, earlyDate);
    if (!av.available) {
      return Response.json({ ok: false, error: 'unavailable', message: av.message || 'Indisponible.' }, { status: 409 });
    }
    const { id: lateId } = await createExtraOrder(env, {
      extra_id: extra.id, title: extra.title + ' — Départ tardif',
      amount_cents: extra.price_cents, currency, guest_name: name, email,
      kind: 'late_checkout', service_date: lateDate,
      status: 'requested', group_id: groupId,
    });
    const { id: earlyId } = await createExtraOrder(env, {
      extra_id: extra.id, title: extra.title + ' — Arrivée anticipée',
      amount_cents: 0, currency, guest_name: name, email,
      kind: 'early_checkin', service_date: earlyDate,
      status: 'requested', group_id: groupId,
    });
    primaryId = lateId;
    orderIds.push(lateId, earlyId);
    summaryTitle = extra.title;
    summaryAmount = extra.price_cents;
    summaryDates = `Départ tardif ${lateDate} · Arrivée anticipée ${earlyDate}`;
  } else {
    const extra = await getExtra(env, parseInt(body.extra_id, 10));
    if (!extra || !extra.active) {
      return Response.json({ ok: false, message: 'Extra indisponible.' }, { status: 404 });
    }
    if (extra.kind !== 'late_checkout' && extra.kind !== 'early_checkin') {
      return Response.json({
        ok: false,
        error: 'kind',
        message: 'Cet extra se paie directement. Utilisez le paiement Stripe.',
      }, { status: 400 });
    }
    const serviceDate = (body.date || '').toString().trim();
    const av = await extraAvailable(env, extra.kind, serviceDate);
    if (!av.available) {
      return Response.json({ ok: false, error: 'unavailable', message: av.message }, { status: 409 });
    }
    let amount = extra.price_cents;
    let title = extra.title;
    const livePromos = await listExtraPromotions(env, { liveOnly: true });
    const promo = (promoId
      ? livePromos.find((p) => p.id === promoId)
      : livePromos.find((p) => p.kind === 'percent' && matchesTarget(p, extra.kind) && Number(p.percent) > 0)
    ) || null;
    if (promo && promo.kind === 'percent' && matchesTarget(promo, extra.kind)) {
      const pct = Math.max(0, Math.min(100, Number(promo.percent) || 0));
      if (pct > 0) {
        amount = Math.max(0, Math.round(extra.price_cents * (100 - pct) / 100));
        title = `${extra.title} (−${pct} %)`;
      }
    }
    if (amount <= 0) return Response.json({ ok: false, message: 'Montant invalide.' }, { status: 400 });
    const { id } = await createExtraOrder(env, {
      extra_id: extra.id, title, amount_cents: amount, currency,
      guest_name: name, email, kind: extra.kind, service_date: serviceDate || null,
      status: 'requested', group_id: groupId,
    });
    primaryId = id;
    orderIds.push(id);
    summaryTitle = title;
    summaryAmount = amount;
    summaryDates = serviceDate
      ? (extra.kind === 'early_checkin' ? `Arrivée le ${serviceDate}` : `Départ le ${serviceDate}`)
      : '';
  }

  const token = await createExtraActionToken(env, primaryId, groupId);
  const acceptUrl = `${origin}/api/extras-approve?token=${encodeURIComponent(token)}&action=accept`;
  const rejectUrl = `${origin}/api/extras-approve?token=${encodeURIComponent(token)}&action=reject`;

  const requestInfo = {
    id: primaryId,
    group_id: groupId,
    title: summaryTitle,
    amount_cents: summaryAmount,
    currency,
    guest_name: name,
    email,
    dates_label: summaryDates,
    return_path: returnPath,
    order_ids: orderIds,
  };

  await Promise.all([
    sendExtraApprovalRequest(env, requestInfo, { acceptUrl, rejectUrl }),
    sendExtraRequestAck(env, requestInfo),
  ]);

  return Response.json({
    ok: true,
    requested: true,
    id: primaryId,
    message: 'Demande envoyée. Vous recevrez un email de confirmation. Le lien de paiement arrivera après validation (hôte / ménage).',
  });
}
