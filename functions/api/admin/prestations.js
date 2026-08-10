// GET/POST/PUT /api/admin/prestations — suivi des ménages dus au prestataire.
// Deux sources de ménages :
//   1. Un séjour direct confirmé = un ménage (auto, comme avant).
//   2. Des prestations saisies à la main, notamment à partir des créneaux occupés par
//      les calendriers externes (Airbnb, Booking…) ou d'un blocage manuel — avec un
//      nombre de ménages, un tarif libre et un extra optionnel.
import {
  ensurePricingSchema, getSettings, listPrestations,
  setCleaningPaid, setCleaningPay, setCleaningPayRate,
  listManualPrestations, createManualPrestation, setManualPrestationPaid,
  setManualPrestationAmount, setManualPrestationExtra, deleteManualPrestation,
  listBlocks,
} from '../../_lib/db.js';
import { fetchExternalRanges } from '../../_lib/ical.js';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const nightsOf = (from, to) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000));

export async function onRequestGet({ env }) {
  await ensurePricingSchema(env);
  const s = await getSettings(env);
  const rate = (s && s.cleaning_pay_cents) || 0;

  // 1. Séjours directs confirmés (auto).
  const rows = await listPrestations(env);
  const bookings = rows.map((b) => {
    const custom = b.cleaning_pay_cents != null;
    return {
      id: b.id, kind: 'booking',
      checkin: b.checkin, checkout: b.checkout, nights: b.nights,
      guest: b.guest_name, source: 'direct',
      paid: !!b.cleaning_paid,
      amountCents: custom ? b.cleaning_pay_cents : rate,
      extraLabel: null, extraCents: 0,
      custom,
    };
  });

  // 2. Prestations saisies à la main.
  const manualRows = await listManualPrestations(env);
  const manual = manualRows.map((m) => ({
    id: m.id, kind: 'manual',
    checkin: m.checkin, checkout: m.checkout, nights: nightsOf(m.checkin, m.checkout),
    guest: null, source: m.source || 'manuel',
    paid: !!m.paid,
    amountCents: m.amount_cents || 0,
    extraLabel: m.extra_label || null, extraCents: m.extra_cents || 0,
    custom: true,
  }));

  // 3. Créneaux occupés proposés (Airbnb/Booking + blocages manuels) — à transformer en
  //    prestation(s) d'un clic. On marque « done » ceux qui ont déjà une prestation au même départ.
  let external = [], blocks = [];
  try {
    [external, blocks] = await Promise.all([
      fetchExternalRanges(env, {}).catch(() => []),
      listBlocks(env).catch(() => []),
    ]);
  } catch (e) { /* pas bloquant */ }
  const doneCheckouts = new Set(manualRows.map((m) => m.checkout));
  const proposals = [
    ...(external || []).map((r) => ({ from: r.from, to: r.to, source: r.source || 'externe' })),
    ...(blocks || []).map((b) => ({ from: b.date_from, to: b.date_to, source: (b.label || 'blocage') })),
  ]
    .filter((p) => p.from && p.to && p.to > p.from)
    .map((p) => ({ from: p.from, to: p.to, nights: nightsOf(p.from, p.to), source: p.source, done: doneCheckouts.has(p.to) }))
    .sort((a, b) => (a.to < b.to ? 1 : a.to > b.to ? -1 : 0));

  return Response.json(
    { ok: true, rate, bookings, manual, proposals },
    { headers: { 'cache-control': 'no-store' } }
  );
}

export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  const b = await request.json().catch(() => ({}));
  const action = (b.action || '').toString();
  const kind = (b.kind || 'booking').toString();

  // --- Ajout manuel de prestation(s) ---
  if (action === 'add') {
    if (!isDate(b.date_from) || !isDate(b.date_to)) {
      return Response.json({ ok: false, message: 'Dates invalides.' }, { status: 400 });
    }
    if (b.date_to <= b.date_from) {
      return Response.json({ ok: false, message: 'Le départ doit être après l’arrivée.' }, { status: 400 });
    }
    const count = Math.min(20, Math.max(1, Math.round(Number(b.count) || 1)));
    const amount = Math.max(0, Math.round(Number(b.amount_cents) || 0));
    const source = (b.source || 'manuel').toString().trim().slice(0, 60) || 'manuel';
    const extraLabel = (b.extra_label || '').toString().trim().slice(0, 80);
    const extraCents = Math.max(0, Math.round(Number(b.extra_cents) || 0));
    for (let i = 0; i < count; i++) {
      await createManualPrestation(env, {
        checkin: b.date_from, checkout: b.date_to, source,
        amount_cents: amount,
        // L'extra ne compte qu'une fois (sur le 1er ménage du séjour).
        extra_label: i === 0 ? extraLabel : '',
        extra_cents: i === 0 ? extraCents : 0,
      });
    }
    return Response.json({ ok: true });
  }

  const id = (b.bookingId || b.id || '').toString();
  if (!id) return Response.json({ ok: false, message: 'Identifiant manquant.' }, { status: 400 });

  // --- Prestation manuelle ---
  if (kind === 'manual') {
    if (action === 'paid') { await setManualPrestationPaid(env, id, true); return Response.json({ ok: true }); }
    if (action === 'unpaid') { await setManualPrestationPaid(env, id, false); return Response.json({ ok: true }); }
    if (action === 'amount') {
      const cents = Math.max(0, Math.round(Number(b.amount_cents) || 0));
      await setManualPrestationAmount(env, id, cents);
      return Response.json({ ok: true });
    }
    if (action === 'extra') {
      await setManualPrestationExtra(env, id, b.extra_label || '', Number(b.extra_cents) || 0);
      return Response.json({ ok: true });
    }
    if (action === 'delete') { await deleteManualPrestation(env, id); return Response.json({ ok: true }); }
    return Response.json({ ok: false, message: 'Action inconnue.' }, { status: 400 });
  }

  // --- Séjour direct confirmé ---
  if (action === 'paid') { await setCleaningPaid(env, id, true); return Response.json({ ok: true }); }
  if (action === 'unpaid') { await setCleaningPaid(env, id, false); return Response.json({ ok: true }); }
  if (action === 'amount') {
    const raw = b.amount_cents;
    const cents = (raw == null || raw === '') ? null : Math.max(0, Math.round(Number(raw)));
    if (cents != null && !Number.isFinite(cents)) return Response.json({ ok: false, message: 'Montant invalide.' }, { status: 400 });
    await setCleaningPay(env, id, cents);
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, message: 'Action inconnue.' }, { status: 400 });
}

// Règle le tarif par défaut payé au prestataire par ménage.
export async function onRequestPut({ env, request }) {
  await ensurePricingSchema(env);
  const b = await request.json().catch(() => ({}));
  await setCleaningPayRate(env, Math.max(0, Math.round(Number(b.cleaning_pay_cents) || 0)));
  return Response.json({ ok: true });
}
