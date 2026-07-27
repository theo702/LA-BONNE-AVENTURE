// POST /api/admin/charge-caution — débite une caution (empreinte bancaire) en cas de dégât.
// Corps : { bookingId, amount_cents }. Crée un PaymentIntent off-session sur la carte enregistrée
// à la réservation, plafonné au montant de caution configuré. Ne prélève rien de plus.
import { getBooking, getSettings } from '../../_lib/db.js';

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const bookingId = (b.bookingId || '').toString().trim();
  let amount = Math.round(Number(b.amount_cents));
  if (!bookingId) return Response.json({ ok: false, message: 'Réservation manquante.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ ok: false, message: 'Montant invalide.' }, { status: 400 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ ok: false, message: 'Stripe non configuré.' }, { status: 500 });

  const booking = await getBooking(env, bookingId);
  if (!booking) return Response.json({ ok: false, message: 'Réservation introuvable.' }, { status: 404 });
  if (!booking.stripe_customer_id || !booking.stripe_payment_method) {
    return Response.json({ ok: false, message: "Aucune empreinte bancaire enregistrée pour cette réservation." }, { status: 400 });
  }

  // Plafond : le montant de caution configuré (sécurité contre une saisie trop élevée).
  const settings = await getSettings(env);
  const cap = (settings && settings.caution_cents) || 0;
  if (cap > 0 && amount > cap) amount = cap;

  const form = new URLSearchParams();
  form.set('amount', String(amount));
  form.set('currency', booking.currency || 'eur');
  form.set('customer', booking.stripe_customer_id);
  form.set('payment_method', booking.stripe_payment_method);
  form.set('off_session', 'true');
  form.set('confirm', 'true');
  form.set('description', `Caution — ${booking.guest_name} (${booking.checkin} → ${booking.checkout})`);
  form.set('metadata[booking_id]', bookingId);
  form.set('metadata[kind]', 'caution');

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const pi = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Cas fréquent : authentification forte requise (SCA) → le débit off-session est refusé.
    const msg = (pi && pi.error && pi.error.message) || 'Le débit a échoué.';
    const needsAuth = pi && pi.error && (pi.error.code === 'authentication_required' || pi.error.code === 'card_declined');
    return Response.json({
      ok: false,
      message: needsAuth
        ? "La banque du voyageur exige une authentification : le débit automatique est refusé. Contactez le voyageur pour régler la caution."
        : msg,
      code: pi && pi.error && pi.error.code,
    }, { status: 402 });
  }

  if (pi.status === 'succeeded') {
    return Response.json({ ok: true, amount_cents: amount, payment_intent: pi.id, status: pi.status });
  }
  // Statuts intermédiaires (requires_action, processing…) → informer l'hôte.
  return Response.json({
    ok: false,
    message: `Débit non finalisé (statut : ${pi.status}). Contactez le voyageur si besoin.`,
    payment_intent: pi.id,
    status: pi.status,
  }, { status: 402 });
}
