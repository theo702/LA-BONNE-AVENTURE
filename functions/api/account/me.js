// GET /api/account/me — infos de l'espace voyageur connecté : réservations + fidélité.
import { getGuestEmail } from '../../_lib/guestAuth.js';
import { listBookingsByEmail, ensurePricingSchema } from '../../_lib/db.js';
import { getLoyaltyStatus } from '../../_lib/loyalty.js';

export async function onRequestGet({ env, request }) {
  const email = await getGuestEmail(env, request);
  if (!email) return Response.json({ ok: false, error: 'auth' }, { status: 401 });

  await ensurePricingSchema(env);
  const [bookings, loyalty] = await Promise.all([
    listBookingsByEmail(env, email),
    getLoyaltyStatus(env, email),
  ]);

  return Response.json({
    ok: true,
    email,
    bookings: bookings.map((b) => ({
      checkin: b.checkin, checkout: b.checkout, nights: b.nights, guests: b.guests,
      amount_total_cents: b.amount_total_cents, currency: b.currency, status: b.status,
    })),
    loyalty,
  }, { headers: { 'cache-control': 'no-store' } });
}
