// POST /api/extras-checkout — paiement Stripe d'un extra.
import { getExtra, createExtraOrder, attachExtraSession } from '../_lib/db.js';
import { extraAvailable } from '../_lib/extraAvail.js';

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const extra = await getExtra(env, parseInt(body.extra_id, 10));
  if (!extra || !extra.active) return Response.json({ ok: false, message: 'Extra indisponible.' }, { status: 404 });

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const serviceDate = (body.date || '').toString().trim();
  if (!name) return Response.json({ ok: false, error: 'name', message: 'Nom requis.' }, { status: 400 });
  if (!isEmail(email)) return Response.json({ ok: false, error: 'email', message: 'Email invalide.' }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, error: 'config', message: 'Paiement non configuré.' }, { status: 500 });

  // Extra sensible au calendrier : revérifie la disponibilité (jour de rotation).
  if (extra.kind === 'late_checkout' || extra.kind === 'early_checkin') {
    const av = await extraAvailable(env, extra.kind, serviceDate);
    if (!av.available) return Response.json({ ok: false, error: 'unavailable', message: av.message }, { status: 409 });
  }

  const currency = 'eur';
  const { id } = await createExtraOrder(env, {
    extra_id: extra.id, title: extra.title, amount_cents: extra.price_cents, currency,
    guest_name: name, email, kind: extra.kind, service_date: serviceDate || null,
  });

  const origin = env.SITE_URL || new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin}/extras?extra=confirmee&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}/extras?extra=annulee`);
  form.set('customer_email', email);
  form.set('client_reference_id', id);
  form.set('metadata[kind]', 'extra');
  form.set('metadata[order_id]', id);
  form.set('payment_intent_data[metadata][kind]', 'extra');
  form.set('payment_intent_data[metadata][order_id]', id);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(extra.price_cents));
  form.set('line_items[0][price_data][product_data][name]', `${extra.title} · La Bonne Aventure`);

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
