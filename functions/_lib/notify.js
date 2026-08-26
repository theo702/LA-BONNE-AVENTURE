// Confirmation d'une réservation + emails (partagé par le webhook et le retour de paiement).
import { getBooking, confirmBooking, incrementPromoUse, getExtraOrder, confirmExtraOrder, confirmExtraOrdersBySession, getSettings, attachStripeCustomer } from './db.js';

function euros(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);
}

// En-tête de marque (navy + or) — texte, robuste dans tous les clients mail. Partagé par
// tous les emails du site (confirmation, extras, lien de connexion…).
function wrap(inner) {
  return `
    <div style="background:#f1ece0;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d4">
        <div style="background:#0f2a4a;padding:22px 24px;text-align:center">
          <div style="color:#d9971a;font-size:19px;letter-spacing:4px;font-weight:600">LA BONNE AVENTURE</div>
          <div style="color:#9fb0c6;font-size:11px;letter-spacing:2px;margin-top:4px">AIX-LES-BAINS</div>
        </div>
        <div style="padding:26px 24px;color:#1f2838">${inner}</div>
      </div>
    </div>`;
}

function sendResend(env, to, subject, html) {
  const from = `La Bonne Aventure <${env.FROM_EMAIL}>`;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  }).catch(() => {});
}

// Envoie le lien de connexion à usage unique à l'espace voyageur.
export async function sendMagicLink(env, email, url) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const html = wrap(`
    <h2 style="color:#0f2a4a;margin:0 0 6px">Votre lien de connexion 🌴</h2>
    <p>Cliquez sur le bouton ci-dessous pour accéder à votre espace (réservations et fidélité).
    Ce lien est valable 15 minutes et à usage unique.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#0f2a4a;color:#fff;text-decoration:none;
        font-family:Arial,sans-serif;font-weight:bold;padding:12px 26px;border-radius:30px">Accéder à mon espace</a>
    </p>
    <p style="color:#5f6675;font-size:13px">Si vous n'avez rien demandé, ignorez simplement cet email.</p>`);
  await sendResend(env, email, 'Votre lien de connexion — La Bonne Aventure', html);
}

function fmtFrDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Rappel hebdo : séjour commencé mais paiement non finalisé.
export async function sendPendingReminder(env, booking) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !booking || !booking.email) return false;
  const origin = env.SITE_URL || 'https://labonneaventure-aixlesbains.fr';
  const name = (booking.guest_name || '').split(' ')[0] || '';
  const hello = name ? `Hey ${name}` : 'Hey';
  const total = euros(booking.amount_total_cents, booking.currency);
  const accountUrl = `${origin}/mon-compte.html`;
  const bookUrl = `${origin}/#booking`;
  const html = wrap(`
    <h2 style="color:#0f2a4a;margin:0 0 6px">${hello} — n’oublie pas de finaliser 🌴</h2>
    <p>Tu as commencé une réservation à <b>La Bonne Aventure</b>, mais le paiement n’est pas encore terminé.</p>
    <p>Tes dates préférées&nbsp;:</p>
    <table style="border-collapse:collapse;margin:14px 0">
      <tr><td style="padding:6px 14px 6px 0;color:#5f6675">Arrivée</td><td style="color:#1f2838"><b>${fmtFrDate(booking.checkin)}</b></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#5f6675">Départ</td><td style="color:#1f2838"><b>${fmtFrDate(booking.checkout)}</b></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#5f6675">Nuits</td><td style="color:#1f2838"><b>${booking.nights}</b></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#5f6675">Total</td><td style="color:#1f2838"><b>${total}</b></td></tr>
    </table>
    <p>Ces dates peuvent partir à tout moment — finalise tant qu’il est encore temps.</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${accountUrl}" style="display:inline-block;background:#0f2a4a;color:#fff;text-decoration:none;
        font-family:Arial,sans-serif;font-weight:bold;padding:12px 26px;border-radius:30px">Finaliser ma réservation</a>
    </p>
    <p style="color:#5f6675;font-size:13px;text-align:center">
      Ou choisis d’autres dates sur <a href="${bookUrl}" style="color:#0f2a4a">le calendrier</a>.
    </p>
    <p style="color:#5f6675;font-size:13px;margin-top:18px">À très vite,<br>Théo · La Bonne Aventure</p>`);
  await sendResend(env, booking.email, 'N’oublie pas de finaliser ta réservation — La Bonne Aventure', html);
  return true;
}

async function sendEmails(env, booking) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const total = euros(booking.amount_total_cents, booking.currency);
  let cautionCents = 0;
  try { const s0 = await getSettings(env); cautionCents = (s0 && s0.caution_cents) || 0; } catch (e) {}
  const cautionNote = cautionCents > 0
    ? `<p style="margin:14px 0;padding:12px 14px;background:#f7f2ea;border-radius:10px;color:#5f6675;font-size:13px">
         🔒 Une caution de <b>${euros(cautionCents, booking.currency)}</b> est demandée sous forme de simple
         empreinte bancaire : <b>rien n'est prélevé</b>, sauf en cas de dégât constaté après votre séjour.</p>`
    : '';
  const send = (to, subject, html) => sendResend(env, to, subject, html);

  const row = (k, v) => `<tr><td style="padding:6px 14px 6px 0;color:#5f6675">${k}</td><td style="color:#1f2838"><b>${v}</b></td></tr>`;

  const guestHtml = wrap(`
      <h2 style="color:#0f2a4a;margin:0 0 6px">Votre réservation est confirmée 🌴</h2>
      <p>Bonjour ${booking.guest_name},</p>
      <p>Merci ! Votre séjour à <b>La Bonne Aventure</b> est bien réservé.</p>
      <table style="border-collapse:collapse;margin:14px 0">
        ${row('Arrivée', booking.checkin + ' (à partir de 16h)')}
        ${row('Départ', booking.checkout + ' (avant 10h)')}
        ${row('Nuits', booking.nights)}
        ${row('Total réglé', total)}
      </table>
      ${cautionNote}
      ${env.SITE_URL ? `<p>Retrouvez cette réservation et vos points fidélité dans <a href="${env.SITE_URL}/mon-compte.html" style="color:#0f2a4a">votre espace voyageur</a>.</p>` : ''}
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

  // Notification à l'équipe ménage (adresses réglées dans l'admin).
  try {
    const s = await getSettings(env);
    const list = ((s && s.cleaning_emails) || '').split(/[\n,; ]+/).map((x) => x.trim()).filter(Boolean);
    if (list.length) {
      const cleanHtml = wrap(`
        <h2 style="color:#0f2a4a;margin:0 0 6px">Ménage à prévoir 🧹</h2>
        <p>Nouvelle réservation à <b>La Bonne Aventure</b> :</p>
        <table style="border-collapse:collapse;margin:14px 0">
          ${row('Arrivée', booking.checkin + ' (dès 16h)')}
          ${row('Départ — ménage', booking.checkout + ' (après 10h)')}
          ${row('Nuits', booking.nights)}
          ${row('Voyageurs', booking.guests)}
        </table>
        <p style="color:#5f6675;font-size:13px">Merci de prévoir le ménage pour le jour du départ.</p>`);
      await Promise.all(list.map((to) => send(to, `Ménage à prévoir — séjour du ${booking.checkin} au ${booking.checkout}`, cleanHtml)));
    }
  } catch (e) { /* pas bloquant */ }
}

async function sendExtraEmails(env, order) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const from = `La Bonne Aventure <${env.FROM_EMAIL}>`;
  const total = euros(order.amount_cents, order.currency);
  const send = (to, subject, html) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    }).catch(() => {});
  const header = `<div style="background:#0f2a4a;padding:20px 24px;text-align:center"><div style="color:#d9971a;font-size:18px;letter-spacing:4px;font-weight:600">LA BONNE AVENTURE</div></div>`;
  const shell = (inner) => `<div style="background:#f1ece0;padding:24px 0;font-family:Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e1d4">${header}<div style="padding:24px;color:#1f2838">${inner}</div></div></div>`;
  await Promise.all([
    order.email ? send(order.email, `Votre extra « ${order.title} » est confirmé`, shell(
      `<h2 style="color:#0f2a4a;margin:0 0 6px">Extra confirmé ✅</h2><p>Bonjour ${order.guest_name || ''},</p>
       <p>Votre option <b>${order.title}</b> (${total}) est bien réglée.${
         order.kind === 'early_checkin' ? ' Votre <b>arrivée</b> est dès <b>12h</b>.' :
         order.kind === 'late_checkout' ? ' Votre <b>départ</b> est jusqu’à <b>14h</b>.' : ''
       } Ces horaires s’affichent aussi dans votre livret d’accueil. Théo revient vers vous si besoin. Merci !</p>`)) : null,
    env.HOST_EMAIL ? send(env.HOST_EMAIL, `Extra payé : ${order.title} (${total})`, shell(
      `<h2 style="color:#a9760f;margin:0 0 6px">Extra payé ✅</h2>
       <p><b>${order.title}</b> — ${total}<br>${order.guest_name || '—'} · ${order.email || '—'}</p>`)) : null,
  ]);
}

// Confirme une commande d'extra (idempotent) + emails. Renvoie l'order ou null.
// Pour un pack flexibilité, confirme aussi la ligne « offerte » liée à la même session Stripe.
export async function confirmExtraAndNotify(env, orderId) {
  if (!orderId) return null;
  const order = await getExtraOrder(env, orderId);
  if (!order) return null;
  if (order.status === 'confirmed') {
    if (order.stripe_session_id) await confirmExtraOrdersBySession(env, order.stripe_session_id);
    return order;
  }
  await confirmExtraOrder(env, orderId);
  if (order.stripe_session_id) await confirmExtraOrdersBySession(env, order.stripe_session_id);
  await sendExtraEmails(env, { ...order, status: 'confirmed' });
  return { ...order, status: 'confirmed' };
}

// Confirme une réservation (idempotent) et envoie les emails.
// Renvoie l'objet réservation confirmé, ou null.
export async function confirmAndNotify(env, bookingId, stripeInfo) {
  if (!bookingId) return null;
  const booking = await getBooking(env, bookingId);
  if (!booking) return null;
  // Empreinte bancaire : enregistre le client + moyen de paiement (même si déjà confirmée,
  // au cas où le webhook confirme avant que confirm.js récupère la carte).
  if (stripeInfo && (stripeInfo.customerId || stripeInfo.paymentMethod)) {
    await attachStripeCustomer(env, bookingId, stripeInfo.customerId, stripeInfo.paymentMethod);
    booking.stripe_customer_id = stripeInfo.customerId || booking.stripe_customer_id;
    booking.stripe_payment_method = stripeInfo.paymentMethod || booking.stripe_payment_method;
  }
  if (booking.status === 'confirmed') return booking; // déjà fait (idempotent)
  await confirmBooking(env, bookingId);
  if (booking.promo_code) await incrementPromoUse(env, booking.promo_code);
  await sendEmails(env, { ...booking, status: 'confirmed' });
  return { ...booking, status: 'confirmed' };
}
