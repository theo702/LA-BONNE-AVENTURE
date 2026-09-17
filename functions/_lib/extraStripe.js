// Création de session Stripe Checkout pour une commande d'extra déjà validée.
import { attachExtraSession } from './db.js';

export function extrasReturnBase(body) {
  const raw = (body && body.return_path ? String(body.return_path) : '').trim().replace(/\.html$/i, '');
  if (raw === '/extras-offre' || raw === 'extras-offre') return '/extras-offre';
  return '/extras';
}

export function setExtrasStripeUrls(form, origin, returnBase) {
  form.set('success_url', `${origin}${returnBase}?extra=confirmee&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}${returnBase}?extra=annulee`);
}

/**
 * Crée une session Stripe pour l'order payant (amount_cents > 0).
 * Attache la session à tous les ids fournis (pack / both).
 * Renvoie { ok, url, sessionId } ou { ok:false, message }.
 */
export async function createStripeCheckoutForOrders(env, {
  paidOrder,
  siblingIds = [],
  origin,
  returnBase = '/extras',
  description = '',
}) {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, message: 'Paiement non configuré.' };
  }
  if (!paidOrder || !(paidOrder.amount_cents > 0)) {
    return { ok: false, message: 'Montant invalide.' };
  }
  const currency = paidOrder.currency || 'eur';
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  setExtrasStripeUrls(form, origin, returnBase);
  if (paidOrder.email) form.set('customer_email', paidOrder.email);
  form.set('client_reference_id', paidOrder.id);
  form.set('metadata[kind]', 'extra');
  form.set('metadata[order_id]', paidOrder.id);
  form.set('payment_intent_data[metadata][kind]', 'extra');
  form.set('payment_intent_data[metadata][order_id]', paidOrder.id);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', currency);
  form.set('line_items[0][price_data][unit_amount]', String(paidOrder.amount_cents));
  form.set('line_items[0][price_data][product_data][name]', `${paidOrder.title} · La Bonne Aventure`);
  if (description) {
    form.set('line_items[0][price_data][product_data][description]', description);
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  if (!res.ok) return { ok: false, message: 'Paiement impossible.' };
  const session = await res.json();
  const allIds = [paidOrder.id, ...siblingIds].filter(Boolean);
  for (const id of allIds) {
    await attachExtraSession(env, id, session.id);
  }
  return { ok: true, url: session.url, sessionId: session.id };
}
