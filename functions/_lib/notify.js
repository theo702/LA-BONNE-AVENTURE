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

  // En-tête de marque (navy + or) — texte, robuste dans tous les clients mail.
  const wrap = (inner) => `
    <div style="background:#f1ece0;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d4">
        <div style="background:#0f2a4a;padding:22px 24px;text-align:center">
          <div style="color:#d9971a;font-size:19px;letter-spacing:4px;font-weight:600">LA BONNE AVENTURE</div>
          <div style="color:#9fb0c6;font-size:11px;letter-spacing:2px;margin-top:4px">AIX-LES-BAINS</div>
        </div>
        <div style="padding:26px 24px;color:#1f2838">${inner}</div>
      </div>
    </div>`;

  const row = (k, v) => `<tr><td style="padding:6px 14px 6px 0;color:#5f6675">${k}</td><td style="color:#1f2838"><b>${v}</b></td></tr>`;

  const guestHtml = wrap(`
      <h2 style="color:#0f2a4a;margin:0 0 6px">Votre réservation est confirmée 🌴</h2>
      <p>Bonjour ${booking.guest_name},</p>
      <p>Merci ! Votre séjour à <b>La Bonne Aventure</b> est bien réservé.</p>
      <table style="border-collapse:collapse;margin:14px 0">
        ${row('Arrivée', booking.checkin + ' (à partir de 16h)')}
        ${row('Départ', booking.checkout + ' (avant 12h)')}
        ${row('Nuits', booking.nights)}
        ${row('Total réglé', total)}
      </table>
      <p>Je vous envoie le code de la boîte à clés la veille de votre arrivée. À très vite !</p>
      <p style="color:#5f6675;font-size:13px;margin-top:18px">Théo · La Bonne Aventure</p>`);

  const hostHtml = wrap(`
      <h2 style="color:#a9760f;margin:0 0 6px">Nouvelle réservation directe ✅</h2>
      <table style="border-collapse:collapse;margin:14px 0">
        ${row('Voyageur', booking.guest_name)}
        ${row('Email', booking.email)}
        ${row('Téléphone', booking.phone || '—')}
        ${row('Dates', booking.checkin + ' → ' + booking.checkout + ' (' + booking.nights + ' nuits)')}
        ${row('Voyageurs', booking.guests)}
        ${row('Montant', total)}
      </table>
      <p style="color:#5f6675;font-size:13px">Les dates sont automatiquement bloquées sur Airbnb via /calendar.ics.</p>`);

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
