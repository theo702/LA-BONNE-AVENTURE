// POST /api/stripe-webhook — confirme la réservation après paiement (voie serveur-à-serveur).
// Sert de filet de sécurité si le client ne revient pas sur le site (voir aussi /api/confirm).
import { cancelBooking } from '../_lib/db.js';
import { confirmAndNotify, confirmExtraAndNotify } from '../_lib/notify.js';

// Vérifie la signature Stripe (HMAC SHA-256) sur le corps brut.
async function verifyStripe(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return diff === 0 && fresh;
}

export async function onRequestPost({ env, request }) {
  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  const ok = await verifyStripe(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('signature invalide', { status: 400 });

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('json invalide', { status: 400 });
  }

  const obj = (event.data && event.data.object) || {};
  const meta = obj.metadata || {};
  const isExtra = meta.kind === 'extra';
  const refId = meta.order_id || meta.booking_id || obj.client_reference_id;

  if (event.type === 'checkout.session.completed') {
    if (isExtra) await confirmExtraAndNotify(env, refId);
    else await confirmAndNotify(env, refId);
  } else if (event.type === 'checkout.session.expired') {
    if (!isExtra && refId) await cancelBooking(env, refId); // libère le blocage temporaire
  }

  return new Response('ok', { status: 200 });
}
