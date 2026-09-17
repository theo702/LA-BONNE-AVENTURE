// GET /api/admin/bookings — liste + stats CA ;
// POST — crée une réservation manuelle (ex. virement) ;
// DELETE ?id= — supprime une réservation.
import {
  listBookings, deleteBookingById, createDirectBooking, bookingRevenueStats, ensurePricingSchema,
} from '../../_lib/db.js';

export async function onRequestGet({ env }) {
  await ensurePricingSchema(env);
  const [bookings, revenue] = await Promise.all([
    listBookings(env),
    bookingRevenueStats(env),
  ]);
  return Response.json({ ok: true, bookings, revenue });
}

export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  let body;
  try { body = await request.json(); } catch (e) {
    return Response.json({ ok: false, message: 'JSON invalide.' }, { status: 400 });
  }
  const checkin = String(body.checkin || '').slice(0, 10);
  const checkout = String(body.checkout || '').slice(0, 10);
  const name = String(body.guest_name || body.name || '').trim();
  const amountEur = Number(body.amount_eur);
  const amountCents = Number.isFinite(Number(body.amount_cents))
    ? Math.round(Number(body.amount_cents))
    : Math.round((Number.isFinite(amountEur) ? amountEur : 0) * 100);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
    return Response.json({ ok: false, message: 'Dates invalides (YYYY-MM-DD).' }, { status: 400 });
  }
  if (checkout <= checkin) {
    return Response.json({ ok: false, message: 'Le départ doit être après l’arrivée.' }, { status: 400 });
  }
  if (!name) {
    return Response.json({ ok: false, message: 'Indiquez le nom du voyageur.' }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents < 0) {
    return Response.json({ ok: false, message: 'Montant invalide.' }, { status: 400 });
  }

  const nights = Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000);
  const guests = Math.max(1, Math.round(Number(body.guests) || 1));
  const paymentSource = body.payment_source === 'stripe' ? 'stripe' : 'virement';

  try {
    const { id } = await createDirectBooking(env, {
      checkin, checkout, nights, name,
      email: String(body.email || '').trim(),
      phone: String(body.phone || '').trim(),
      guests,
      amountCents,
      taxeCents: Math.max(0, Math.round(Number(body.taxe_cents) || 0)),
      notes: String(body.notes || '').trim() || null,
      paymentSource,
      currency: 'eur',
    });
    const [bookings, revenue] = await Promise.all([
      listBookings(env),
      bookingRevenueStats(env),
    ]);
    return Response.json({ ok: true, id, bookings, revenue });
  } catch (e) {
    return Response.json({ ok: false, message: (e && e.message) || 'Création impossible.' }, { status: 500 });
  }
}

export async function onRequestDelete({ env, request }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, message: 'id manquant.' }, { status: 400 });
  await deleteBookingById(env, id);
  return Response.json({ ok: true });
}
