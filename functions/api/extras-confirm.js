// GET /api/extras-confirm?session_id=... — confirme un extra au retour du paiement.
import { confirmExtraAndNotify } from '../_lib/notify.js';

export async function onRequestGet({ env, request }) {
  const sid = new URL(request.url).searchParams.get('session_id');
  if (!sid) return Response.json({ ok: false }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false }, { status: 500 });

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) return Response.json({ ok: false }, { status: 400 });
  const session = await res.json();
  if (session.payment_status !== 'paid') return Response.json({ ok: false, status: session.payment_status });

  const orderId = (session.metadata && session.metadata.order_id) || session.client_reference_id;
  const order = await confirmExtraAndNotify(env, orderId);
  if (!order) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, title: order.title, amount_cents: order.amount_cents, currency: order.currency });
}
