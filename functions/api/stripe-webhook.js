// POST /api/stripe-webhook — confirme la réservation après paiement, envoie les emails.
import { getBooking, confirmBooking, cancelBooking, incrementPromoUse } from '../_lib/db.js';

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
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // comparaison à temps ~constant + fenêtre anti-rejeu de 5 min
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return diff === 0 && fresh;
}

function euros(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);
}

async function sendEmails(env, booking) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const from = `La Bonne Aventure <${env.FROM_EMAIL}>`;
  const total = euros(booking.amount_total_cents, booking.currency);
  const send = (to, subject, html) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    }).catch(() => {});

  const guestHtml = `
    <div style="font-family:Arial,sans-serif;color:#33302A;max-width:520px">
      <h2 style="color:#37564A">Votre réservation est confirmée 🌴</h2>
      <p>Bonjour ${booking.guest_name},</p>
      <p>Merci ! Votre séjour à <b>La Bonne Aventure</b> (Aix-les-Bains) est bien réservé.</p>
      <table style="border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Arrivée</td><td><b>${booking.checkin}</b> (à partir de 16h)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Départ</td><td><b>${booking.checkout}</b> (avant 12h)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Nuits</td><td>${booking.nights}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Total réglé</td><td><b>${total}</b></td></tr>
      </table>
      <p>Je vous envoie le code de la boîte à clés la veille de votre arrivée. À très vite !</p>
      <p style="color:#6B6353;font-size:13px">Théo · La Bonne Aventure</p>
    </div>`;

  const hostHtml = `
    <div style="font-family:Arial,sans-serif;color:#33302A;max-width:520px">
      <h2 style="color:#C0563B">Nouvelle réservation directe ✅</h2>
      <table style="border-collapse:collapse;margin:14px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Voyageur</td><td><b>${booking.guest_name}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Email</td><td>${booking.email}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Téléphone</td><td>${booking.phone || '—'}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Dates</td><td>${booking.checkin} → ${booking.checkout} (${booking.nights} nuits)</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Voyageurs</td><td>${booking.guests}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B6353">Montant</td><td><b>${total}</b></td></tr>
      </table>
      <p style="color:#6B6353;font-size:13px">Les dates sont automatiquement bloquées sur Airbnb via /calendar.ics.</p>
    </div>`;

  await Promise.all([
    send(booking.email, 'Votre réservation à La Bonne Aventure est confirmée', guestHtml),
    env.HOST_EMAIL ? send(env.HOST_EMAIL, `Nouvelle résa : ${booking.guest_name} (${booking.checkin})`, hostHtml) : null,
  ]);
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

  const obj = event.data && event.data.object ? event.data.object : {};
  const bookingId = (obj.metadata && obj.metadata.booking_id) || obj.client_reference_id;

  if (event.type === 'checkout.session.completed') {
    if (bookingId) {
      const booking = await getBooking(env, bookingId);
      if (booking && booking.status !== 'confirmed') {
        await confirmBooking(env, bookingId);
        if (booking.promo_code) await incrementPromoUse(env, booking.promo_code);
        await sendEmails(env, { ...booking, status: 'confirmed' });
      }
    }
  } else if (event.type === 'checkout.session.expired') {
    if (bookingId) await cancelBooking(env, bookingId); // libère le blocage temporaire
  }

  return new Response('ok', { status: 200 });
}
