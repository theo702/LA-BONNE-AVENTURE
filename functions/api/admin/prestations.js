// GET/POST/PUT /api/admin/prestations — suivi des ménages dus au prestataire.
// Un séjour confirmé = un ménage. Montant par défaut réglable ; personnalisable par séjour ;
// statut « payé » coché au fur et à mesure.
import {
  ensurePricingSchema, getSettings, listPrestations,
  setCleaningPaid, setCleaningPay, setCleaningPayRate,
} from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  await ensurePricingSchema(env);
  const s = await getSettings(env);
  const rate = (s && s.cleaning_pay_cents) || 0;
  const rows = await listPrestations(env);
  const bookings = rows.map((b) => {
    const custom = b.cleaning_pay_cents != null;
    return {
      id: b.id,
      checkin: b.checkin,
      checkout: b.checkout,
      nights: b.nights,
      guest: b.guest_name,
      paid: !!b.cleaning_paid,
      amountCents: custom ? b.cleaning_pay_cents : rate,
      custom,
    };
  });
  return Response.json({ ok: true, rate, bookings }, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  const b = await request.json().catch(() => ({}));
  const id = (b.bookingId || '').toString();
  if (!id) return Response.json({ ok: false, message: 'Réservation manquante.' }, { status: 400 });

  if (b.action === 'paid') { await setCleaningPaid(env, id, true); return Response.json({ ok: true }); }
  if (b.action === 'unpaid') { await setCleaningPaid(env, id, false); return Response.json({ ok: true }); }
  if (b.action === 'amount') {
    // '' ou null → retour au tarif par défaut ; sinon montant en centimes.
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
