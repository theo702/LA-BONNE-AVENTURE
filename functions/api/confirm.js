// GET /api/confirm?session_id=... — confirme la réservation au retour du paiement.
// Vérifie auprès de Stripe que la session est bien payée (ne fait pas confiance au client),
// puis confirme + envoie les emails. Fonctionne même si le webhook n'est pas opérationnel.
import { confirmAndNotify } from '../_lib/notify.js';

export async function onRequestGet({ env, request }) {
  const sid = new URL(request.url).searchParams.get('session_id');
  if (!sid) return Response.json({ ok: false, error: 'session' }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, error: 'config' }, { status: 500 });

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return Response.json({ ok: false, error: 'stripe' }, { status: 400 });

  const session = await res.json();
  if (session.payment_status !== 'paid') {
    return Response.json({ ok: false, error: 'unpaid', status: session.payment_status });
  }

  const bookingId = (session.metadata && session.metadata.booking_id) || session.client_reference_id;
  const done = await confirmAndNotify(env, bookingId);
  return Response.json({ ok: done }, { headers: { 'cache-control': 'no-store' } });
}
