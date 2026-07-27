// GET /api/confirm?session_id=... — confirme la réservation au retour du paiement.
// Vérifie auprès de Stripe que la session est bien payée (ne fait pas confiance au client),
// puis confirme + envoie les emails. Fonctionne même si le webhook n'est pas opérationnel.
import { confirmAndNotify } from '../_lib/notify.js';

export async function onRequestGet({ env, request }) {
  const sid = new URL(request.url).searchParams.get('session_id');
  if (!sid) return Response.json({ ok: false, error: 'session' }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, error: 'config' }, { status: 500 });

  // On étend payment_intent pour récupérer le moyen de paiement enregistré (empreinte / caution).
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}?expand[]=payment_intent`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
  );
  if (!res.ok) return Response.json({ ok: false, error: 'stripe' }, { status: 400 });

  const session = await res.json();
  if (session.payment_status !== 'paid') {
    return Response.json({ ok: false, error: 'unpaid', status: session.payment_status });
  }

  const bookingId = (session.metadata && session.metadata.booking_id) || session.client_reference_id;
  const pi = session.payment_intent && typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const stripeInfo = {
    customerId: typeof session.customer === 'string' ? session.customer : (session.customer && session.customer.id) || null,
    paymentMethod: pi ? (typeof pi.payment_method === 'string' ? pi.payment_method : (pi.payment_method && pi.payment_method.id) || null) : null,
  };
  const booking = await confirmAndNotify(env, bookingId, stripeInfo);
  if (!booking) return Response.json({ ok: false, error: 'booking' }, { status: 404 });

  return Response.json({
    ok: true,
    booking: {
      guest_name: booking.guest_name,
      email: booking.email,
      checkin: booking.checkin,
      checkout: booking.checkout,
      nights: booking.nights,
      amount_total_cents: booking.amount_total_cents,
      currency: booking.currency,
    },
  }, { headers: { 'cache-control': 'no-store' } });
}
