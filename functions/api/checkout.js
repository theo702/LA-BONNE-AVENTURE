// POST /api/checkout — re-synchro live, blocage temporaire, session de paiement Stripe.
import { loadSettings, loadSeasons, validatePromo, computeQuote } from '../_lib/pricing.js';
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges, overlaps, createPendingBooking, attachSession } from '../_lib/db.js';

function isEmail(s) { return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const [settings, seasons] = await Promise.all([loadSettings(env), loadSeasons(env)]);

  const nights = (body.checkin && body.checkout)
    ? Math.round((Date.parse(body.checkout) - Date.parse(body.checkin)) / 86400000)
    : 0;
  const promoRes = await validatePromo(env, body.promo, { nights, checkin: body.checkin });
  if (!promoRes.ok) return Response.json({ ok: false, error: 'promo', message: promoRes.message }, { status: 400 });

  const quote = computeQuote(body, { settings, seasons, promo: promoRes.promo });
  if (!quote.ok) return Response.json(quote, { status: 400 });

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const phone = (body.phone || '').toString().trim();
  if (!name) return Response.json({ ok: false, error: 'name', message: 'Nom requis.' }, { status: 400 });
  if (!isEmail(email)) return Response.json({ ok: false, error: 'email', message: 'Email invalide.' }, { status: 400 });

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ ok: false, error: 'config', message: 'Paiement non configuré.' }, { status: 500 });
  }

  // Garde-fou anti double-résa : re-synchro LIVE d'Airbnb + réservations en base.
  const [external, busy] = await Promise.all([
    fetchExternalRanges(env, { bypassCache: true }),
    getBusyRanges(env),
  ]);
  const conflict = [...external, ...busy].some((r) => overlaps(quote.checkin, quote.checkout, r.from, r.to));
  if (conflict) {
    return Response.json({ ok: false, error: 'unavailable', message: 'Ces dates viennent d’être réservées ailleurs.' }, { status: 409 });
  }

  // Blocage temporaire (hold 30 min).
  const { id } = await createPendingBooking(env, {
    checkin: quote.checkin, checkout: quote.checkout, nights: quote.nights,
    name, email, phone, guests: quote.guests,
    amountCents: quote.totalCents, taxeCents: quote.taxeCents,
    discountCents: quote.discountCents, promoCode: quote.promoCode, currency: quote.currency,
  });

  // Session Stripe Checkout.
  const origin = env.SITE_URL || new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin}/?reservation=confirmee`);
  form.set('cancel_url', `${origin}/?reservation=annulee`);
  form.set('customer_email', email);
  form.set('client_reference_id', id);
  form.set('metadata[booking_id]', id);
  form.set('payment_intent_data[metadata][booking_id]', id);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', quote.currency);
  form.set('line_items[0][price_data][unit_amount]', String(quote.totalCents));
  form.set('line_items[0][price_data][product_data][name]', 'Séjour · La Bonne Aventure');
  form.set('line_items[0][price_data][product_data][description]',
    `${quote.checkin} → ${quote.checkout} · ${quote.nights} nuits · ménage inclus`);
  form.set('expires_at', String(Math.floor(Date.now() / 1000) + 30 * 60));

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ ok: false, error: 'stripe', message: 'Impossible de créer le paiement.', detail }, { status: 502 });
  }

  const session = await res.json();
  await attachSession(env, id, session.id);
  return Response.json({ ok: true, url: session.url });
}
