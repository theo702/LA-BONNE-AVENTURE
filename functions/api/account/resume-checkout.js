// POST /api/account/resume-checkout — reprend le paiement d'un séjour « en attente ».
import { getGuestEmail } from '../../_lib/guestAuth.js';
import { getBooking, getBusyRanges, overlaps, attachSession, renewPendingHold } from '../../_lib/db.js';
import { fetchExternalRanges } from '../../_lib/ical.js';
import { loadSettings } from '../../_lib/pricing.js';

export async function onRequestPost({ env, request }) {
  const email = await getGuestEmail(env, request);
  if (!email) return Response.json({ ok: false, error: 'auth' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const bookingId = (body.booking_id || '').toString().trim();
  if (!bookingId) {
    return Response.json({ ok: false, error: 'booking_id', message: 'Réservation manquante.' }, { status: 400 });
  }

  const booking = await getBooking(env, bookingId);
  if (!booking || (booking.email || '').toLowerCase() !== email.toLowerCase()) {
    return Response.json({ ok: false, error: 'not_found', message: 'Séjour introuvable.' }, { status: 404 });
  }
  if (booking.status !== 'pending') {
    return Response.json({
      ok: false, error: 'status',
      message: booking.status === 'confirmed'
        ? 'Ce séjour est déjà confirmé.'
        : 'Ce séjour ne peut plus être payé.',
    }, { status: 400 });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ ok: false, error: 'config', message: 'Paiement non configuré.' }, { status: 500 });
  }

  // Vérifie que les dates sont encore libres (en ignorant le hold de cette résa).
  const [external, busy, settings] = await Promise.all([
    fetchExternalRanges(env, { bypassCache: true }),
    getBusyRanges(env, { exceptId: booking.id }),
    loadSettings(env),
  ]);
  const conflict = [...external, ...busy].some((r) =>
    overlaps(booking.checkin, booking.checkout, r.from, r.to)
  );
  if (conflict) {
    return Response.json({
      ok: false,
      error: 'unavailable',
      message: 'Ces dates ne sont plus disponibles. Choisissez d’autres dates pour réserver.',
    }, { status: 409 });
  }

  await renewPendingHold(env, booking.id);

  const origin = env.SITE_URL || new URL(request.url).origin;
  const currency = booking.currency || 'eur';
  const amount = booking.amount_total_cents;
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', `${origin}/?reservation=confirmee&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}/mon-compte.html?reservation=annulee`);
  form.set('customer_email', booking.email);
  form.set('client_reference_id', booking.id);
  form.set('metadata[booking_id]', booking.id);
  form.set('payment_intent_data[metadata][booking_id]', booking.id);
  if ((settings.caution_cents || 0) > 0) {
    form.set('customer_creation', 'always');
    form.set('payment_intent_data[setup_future_usage]', 'off_session');
  }
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(amount));
  form.set('line_items[0][price_data][product_data][name]', 'Séjour · La Bonne Aventure');
  form.set('line_items[0][price_data][product_data][description]',
    `${booking.checkin} → ${booking.checkout} · ${booking.nights} nuits · ménage inclus`);
  form.set('expires_at', String(Math.floor(Date.now() / 1000) + 30 * 60));

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({
      ok: false, error: 'stripe', message: 'Impossible de créer le paiement.', detail,
    }, { status: 502 });
  }

  const session = await res.json();
  await attachSession(env, booking.id, session.id);
  return Response.json({ ok: true, url: session.url }, { headers: { 'cache-control': 'no-store' } });
}
