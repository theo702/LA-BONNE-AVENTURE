// Confirmation d'une réservation + emails (partagé par le webhook et le retour de paiement).
import { getBooking, confirmBooking, incrementPromoUse } from './db.js';

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

// Confirme une réservation (idempotent) et envoie les emails.
// Renvoie l'objet réservation confirmé, ou null.
export async function confirmAndNotify(env, bookingId) {
  if (!bookingId) return null;
  const booking = await getBooking(env, bookingId);
  if (!booking) return null;
  if (booking.status === 'confirmed') return booking; // déjà fait (idempotent)
  await confirmBooking(env, bookingId);
  if (booking.promo_code) await incrementPromoUse(env, booking.promo_code);
  await sendEmails(env, { ...booking, status: 'confirmed' });
  return { ...booking, status: 'confirmed' };
}
