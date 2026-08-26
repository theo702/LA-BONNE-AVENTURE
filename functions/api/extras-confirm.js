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

  let early = order.kind === 'early_checkin';
  let late = order.kind === 'late_checkout';
  if (order.stripe_session_id && env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT kind FROM extra_orders WHERE stripe_session_id = ?1 AND status = 'confirmed'`
      ).bind(order.stripe_session_id).all();
      (results || []).forEach((r) => {
        if (r.kind === 'early_checkin') early = true;
        if (r.kind === 'late_checkout') late = true;
      });
    } catch (e) { /* ignore */ }
  }

  return Response.json({
    ok: true,
    title: order.title,
    amount_cents: order.amount_cents,
    currency: order.currency,
    kind: order.kind,
    email: order.email || '',
    early,
    late,
    arrival: early ? '12:00' : '16:00',
    departure: late ? '14:00' : '10:00',
  });
}
