// POST /api/extras-checkout — paiement Stripe d'un extra (ou pack promo).
import {
  getExtra, createExtraOrder, attachExtraSession, getExtraPromotion, listExtraPromotions,
} from '../_lib/db.js';
import { extraAvailable, extraAvailableBoth } from '../_lib/extraAvail.js';
import { weeklyPackQuote } from '../_lib/weeklyPack.js';

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

/** Page de retour Stripe : /extras (livret) ou /extras-offre (lien partagé, sans Retour). */
function extrasReturnBase(body) {
  const raw = (body && body.return_path ? String(body.return_path) : '').trim().replace(/\.html$/i, '');
  if (raw === '/extras-offre' || raw === 'extras-offre') return '/extras-offre';
  return '/extras';
}

function setExtrasStripeUrls(form, origin, returnBase) {
  form.set('success_url', `${origin}${returnBase}?extra=confirmee&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}${returnBase}?extra=annulee`);
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  if (!name) return Response.json({ ok: false, error: 'name', message: 'Nom requis.' }, { status: 400 });
  if (!isEmail(email)) return Response.json({ ok: false, error: 'email', message: 'Email invalide.' }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, error: 'config', message: 'Paiement non configuré.' }, { status: 500 });

  const currency = 'eur';
  const origin = env.SITE_URL || new URL(request.url).origin;
  const returnBase = extrasReturnBase(body);
  const promoId = body.promo_id ? parseInt(body.promo_id, 10) : 0;
  const isPack = body.kind === 'flex_pack' || String(body.extra_id || '').startsWith('pack:');
  const isBoth = !isPack && body.kind === 'both';
  const isWeekly = !isPack && !isBoth && body.kind === 'weekly';

  // ---------- Pack curiste : arrivée + départ → N samedis (1–4) × prix / sem. ----------
  if (isWeekly) {
    const extra = await getExtra(env, parseInt(body.extra_id, 10));
    if (!extra || !extra.active || extra.kind !== 'weekly') {
      return Response.json({ ok: false, message: 'Extra indisponible.' }, { status: 404 });
    }
    const arrival = (body.arrival_date || body.early_date || body.date_arrival || '').toString().trim();
    const departure = (body.departure_date || body.late_date || body.date_departure || '').toString().trim();
    const quote = weeklyPackQuote(arrival, departure, extra.price_cents);
    if (!quote.ok || quote.amount_cents <= 0) {
      return Response.json({ ok: false, error: 'dates', message: quote.message || 'Dates invalides.' }, { status: 400 });
    }
    const weeks = quote.weeks;
    const amount = quote.amount_cents;
    const title = `${extra.title} × ${weeks} sem.`;
    const { id } = await createExtraOrder(env, {
      extra_id: extra.id,
      title: `${title} (${arrival} → ${departure})`,
      amount_cents: amount,
      currency,
      guest_name: name,
      email,
      kind: 'weekly',
      service_date: arrival,
    });

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    setExtrasStripeUrls(form, origin, returnBase);
    form.set('customer_email', email);
    form.set('client_reference_id', id);
    form.set('metadata[kind]', 'extra');
    form.set('metadata[order_id]', id);
    form.set('metadata[weeks]', String(weeks));
    form.set('metadata[arrival]', arrival);
    form.set('metadata[departure]', departure);
    form.set('payment_intent_data[metadata][kind]', 'extra');
    form.set('payment_intent_data[metadata][order_id]', id);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', currency);
    form.set('line_items[0][price_data][unit_amount]', String(amount));
    form.set('line_items[0][price_data][product_data][name]', `${title} · La Bonne Aventure`);
    form.set('line_items[0][price_data][product_data][description]',
      `${weeks} ménage${weeks > 1 ? 's' : ''} + linge · séjour ${arrival} → ${departure}`);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) return Response.json({ ok: false, message: 'Paiement impossible.' }, { status: 502 });
    const session = await res.json();
    await attachExtraSession(env, id, session.id);
    return Response.json({ ok: true, url: session.url, weeks, amount_cents: amount });
  }

  // ---------- Pack flexibilité : départ tardif + arrivée anticipée pour le prix d'un ----------
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
    });
    const { id: freeId } = await createExtraOrder(env, {
      extra_id: null, title: title + ' — Arrivée anticipée (offerte)',
      amount_cents: 0, currency, guest_name: name, email,
      kind: 'early_checkin', service_date: earlyDate,
    });

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    setExtrasStripeUrls(form, origin, returnBase);
    form.set('customer_email', email);
    form.set('client_reference_id', paidId);
    form.set('metadata[kind]', 'extra');
    form.set('metadata[order_id]', paidId);
    form.set('metadata[pack_free_id]', freeId);
    form.set('metadata[promo_id]', String(promo.id));
    form.set('payment_intent_data[metadata][kind]', 'extra');
    form.set('payment_intent_data[metadata][order_id]', paidId);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', currency);
    form.set('line_items[0][price_data][unit_amount]', String(amount));
    form.set('line_items[0][price_data][product_data][name]', `${title} · La Bonne Aventure`);
    form.set('line_items[0][price_data][product_data][description]',
      `Départ tardif (${lateDate}) + arrivée anticipée offerte (${earlyDate})`);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) return Response.json({ ok: false, message: 'Paiement impossible.' }, { status: 502 });
    const session = await res.json();
    await attachExtraSession(env, paidId, session.id);
    await attachExtraSession(env, freeId, session.id);
    return Response.json({ ok: true, url: session.url });
  }

  // ---------- Extra "both" : départ tardif + arrivée anticipée, un seul paiement ----------
  if (isBoth) {
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
    const amount = extra.price_cents;
    const title = extra.title;
    const { id: lateId } = await createExtraOrder(env, {
      extra_id: extra.id, title: title + ' — Départ tardif',
      amount_cents: amount, currency, guest_name: name, email,
      kind: 'late_checkout', service_date: lateDate,
    });
    const { id: earlyId } = await createExtraOrder(env, {
      extra_id: extra.id, title: title + ' — Arrivée anticipée',
      amount_cents: 0, currency, guest_name: name, email,
      kind: 'early_checkin', service_date: earlyDate,
    });

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    setExtrasStripeUrls(form, origin, returnBase);
    form.set('customer_email', email);
    form.set('client_reference_id', lateId);
    form.set('metadata[kind]', 'extra');
    form.set('metadata[order_id]', lateId);
    form.set('metadata[pack_free_id]', earlyId);
    form.set('payment_intent_data[metadata][kind]', 'extra');
    form.set('payment_intent_data[metadata][order_id]', lateId);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', currency);
    form.set('line_items[0][price_data][unit_amount]', String(amount));
    form.set('line_items[0][price_data][product_data][name]', `${title} · La Bonne Aventure`);
    form.set('line_items[0][price_data][product_data][description]',
      `Départ tardif (${lateDate}) + arrivée anticipée (${earlyDate})`);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    if (!res.ok) return Response.json({ ok: false, message: 'Paiement impossible.' }, { status: 502 });
    const session = await res.json();
    await attachExtraSession(env, lateId, session.id);
    await attachExtraSession(env, earlyId, session.id);
    return Response.json({ ok: true, url: session.url });
  }

  // ---------- Extra simple (+ éventuelle réduction %) ----------
  const extra = await getExtra(env, parseInt(body.extra_id, 10));
  if (!extra || !extra.active) return Response.json({ ok: false, message: 'Extra indisponible.' }, { status: 404 });
  if (extra.kind === 'weekly') {
    return Response.json({
      ok: false,
      message: 'Indiquez vos dates d’arrivée et de départ pour le pack curiste.',
    }, { status: 400 });
  }

  const serviceDate = (body.date || '').toString().trim();
  if (extra.kind === 'late_checkout' || extra.kind === 'early_checkin') {
    const av = await extraAvailable(env, extra.kind, serviceDate);
    if (!av.available) return Response.json({ ok: false, error: 'unavailable', message: av.message }, { status: 409 });
  }

  let amount = extra.price_cents;
  let title = extra.title;
  let appliedPromo = null;
  const livePromos = await listExtraPromotions(env, { liveOnly: true });
  const promo = (promoId
    ? livePromos.find((p) => p.id === promoId)
    : livePromos.find((p) => p.kind === 'percent' && matchesTarget(p, extra.kind) && Number(p.percent) > 0)
  ) || null;
  if (promo && promo.kind === 'percent' && matchesTarget(promo, extra.kind)) {
    const pct = Math.max(0, Math.min(100, Number(promo.percent) || 0));
    if (pct > 0) {
      amount = Math.max(0, Math.round(extra.price_cents * (100 - pct) / 100));
      appliedPromo = promo;
      title = `${extra.title} (−${pct} %)`;
    }
  }

  if (amount <= 0) return Response.json({ ok: false, message: 'Montant invalide.' }, { status: 400 });

  const { id } = await createExtraOrder(env, {
    extra_id: extra.id, title, amount_cents: amount, currency,
    guest_name: name, email, kind: extra.kind, service_date: serviceDate || null,
  });

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  setExtrasStripeUrls(form, origin, returnBase);
  form.set('customer_email', email);
  form.set('client_reference_id', id);
  form.set('metadata[kind]', 'extra');
  form.set('metadata[order_id]', id);
  if (appliedPromo) form.set('metadata[promo_id]', String(appliedPromo.id));
  form.set('payment_intent_data[metadata][kind]', 'extra');
  form.set('payment_intent_data[metadata][order_id]', id);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(amount));
  form.set('line_items[0][price_data][product_data][name]', `${title} · La Bonne Aventure`);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!res.ok) return Response.json({ ok: false, message: 'Paiement impossible.' }, { status: 502 });

  const session = await res.json();
  await attachExtraSession(env, id, session.id);
  return Response.json({ ok: true, url: session.url });
}
