// Confirmation d'une réservation + emails (partagé par le webhook et le retour de paiement).
import { getBooking, confirmBooking, incrementPromoUse, getExtraOrder, confirmExtraOrder, confirmExtraOrdersBySession, getSettings, attachStripeCustomer } from './db.js';

function euros(cents, currency = 'eur') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format((cents || 0) / 100);
}

// ---------------------------------------------------------------------------
// Gabarit commun à tous les mails du site (voyageurs, hôte, ménage).
// Tableaux + styles en ligne : rendu propre dans Gmail, Apple Mail, Outlook.
// ---------------------------------------------------------------------------
const C = { navy: '#0f2a4a', gold: '#a9760f', goldL: '#d9971a', ink: '#1f2838', mute: '#5f6675', line: '#E6E1D4', soft: '#FBF7EE', bg: '#F3EEE3', ok: '#3f6b4a', no: '#9A3412' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SITE = 'https://labonneaventure-aixlesbains.fr';

function escH(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const firstName = (n) => escH(String(n || '').trim().split(/\s+/)[0] || '');

// Date lisible : « samedi 12 décembre 2026 » (ou courte : « sam. 12 déc. »).
function frDate(iso, short) {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
  if (isNaN(d)) return escH(iso);
  return d.toLocaleDateString('fr-FR', short
    ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const P = (html) => `<p style="margin:0 0 14px;font:400 15px/1.6 ${SANS};color:${C.ink}">${html}</p>`;
const SMALL = (html) => `<p style="margin:16px 0 0;font:400 13px/1.55 ${SANS};color:${C.mute}">${html}</p>`;

function details(rows) {
  const tr = rows.filter(Boolean).map(([k, v], i) => `
    <tr>
      <td style="padding:10px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:400 13px/1.4 ${SANS};color:${C.mute};width:38%;vertical-align:top">${k}</td>
      <td style="padding:10px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:600 14px/1.4 ${SANS};color:${C.ink};vertical-align:top">${v}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:6px 0 18px;background:${C.soft};border:1px solid ${C.line};border-radius:12px">${tr}</table>`;
}

function button(href, label, bg = C.navy) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr>
    <td style="border-radius:10px;background:${bg}">
      <a href="${href}" style="display:inline-block;padding:14px 26px;font:600 13px/1 ${SANS};letter-spacing:1.2px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:10px">${label}</a>
    </td></tr></table>`;
}
function twoButtons(a, b) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr>
    <td style="border-radius:10px;background:${a.bg}"><a href="${a.href}" style="display:inline-block;padding:14px 24px;font:600 13px/1 ${SANS};letter-spacing:1.2px;text-transform:uppercase;color:#fff;text-decoration:none">${a.label}</a></td>
    <td style="width:10px"></td>
    <td style="border-radius:10px;background:#ffffff;border:1px solid ${C.line}"><a href="${b.href}" style="display:inline-block;padding:13px 24px;font:600 13px/1 ${SANS};letter-spacing:1.2px;text-transform:uppercase;color:${b.color};text-decoration:none">${b.label}</a></td>
  </tr></table>`;
}
function note(html) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px"><tr>
    <td style="padding:12px 16px;border-left:3px solid ${C.goldL};background:${C.soft};font:400 13.5px/1.55 ${SANS};color:${C.ink}">${html}</td></tr></table>`;
}

// audience : 'guest' (voyageur) · 'team' (hôte / ménage).
function layout({ preheader = '', kicker = '', title = '', body = '', audience = 'guest' }) {
  const sign = audience === 'guest'
    ? `<p style="margin:26px 0 0;font:400 15px/1.5 ${SANS};color:${C.ink}">À très bientôt,<br><span style="font-family:${SERIF};font-style:italic;color:${C.navy}">Théo</span></p>`
    : '';
  const foot = audience === 'guest'
    ? `La Bonne Aventure · Studio à Aix-les-Bains<br><a href="${SITE}" style="color:${C.gold};text-decoration:none">labonneaventure-aixlesbains.fr</a>`
    : `Message automatique de votre site <a href="${SITE}/admin" style="color:${C.gold};text-decoration:none">La Bonne Aventure</a>`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escH(title.replace(/<[^>]+>/g, ''))}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escH(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${C.line};border-radius:16px;overflow:hidden">
      <tr><td style="background:${C.navy};padding:22px 28px">
        <span style="font:400 21px/1 ${SERIF};color:#ffffff;letter-spacing:.3px">La Bonne Aventure</span>
        <span style="font:600 10.5px/1 ${SANS};color:${C.goldL};letter-spacing:2px;text-transform:uppercase;padding-left:10px">Aix-les-Bains</span>
      </td></tr>
      <tr><td style="padding:30px 28px 30px">
        ${kicker ? `<p style="margin:0 0 8px;font:600 11px/1 ${SANS};letter-spacing:1.8px;text-transform:uppercase;color:${C.gold}">${kicker}</p>` : ''}
        <h1 style="margin:0 0 18px;font:400 25px/1.25 ${SERIF};color:${C.navy}">${title}</h1>
        ${body}
        ${sign}
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid ${C.line};font:400 12px/1.6 ${SANS};color:${C.mute}">${foot}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function sendResend(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return Promise.resolve({ ok: false, message: 'Email non configuré (RESEND / FROM_EMAIL).' });
  }
  const from = `La Bonne Aventure <${env.FROM_EMAIL}>`;
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    // Les réponses arrivent directement dans la boîte de l'hôte.
    body: JSON.stringify(Object.assign({ from, to: [to], subject, html }, env.HOST_EMAIL && to !== env.HOST_EMAIL ? { reply_to: env.HOST_EMAIL } : {})),
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: (data && (data.message || data.error)) || (`Resend HTTP ${res.status}`) };
    }
    return { ok: true, id: data && data.id };
  }).catch((e) => ({ ok: false, message: e && e.message ? e.message : String(e) }));
}

// Lien de connexion à usage unique à l'espace voyageur.
export async function sendMagicLink(env, email, url) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const html = layout({
    preheader: 'Votre lien pour accéder à votre espace voyageur.',
    kicker: 'Espace voyageur',
    title: 'Votre lien de connexion',
    body: P('Touchez le bouton ci-dessous pour retrouver vos réservations et vos avantages fidélité.') +
      button(url, 'Accéder à mon espace') +
      SMALL('Ce lien est valable 15 minutes et ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez simplement ce message.'),
  });
  await sendResend(env, email, 'Votre lien de connexion · La Bonne Aventure', html);
}

// Rappel : réservation commencée mais paiement non finalisé.
export async function sendPendingReminder(env, booking) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !booking || !booking.email) return false;
  const origin = env.SITE_URL || SITE;
  const name = firstName(booking.guest_name);
  const html = layout({
    preheader: 'Vos dates sont encore libres, mais pour combien de temps ?',
    kicker: 'Réservation en attente',
    title: 'Votre séjour vous attend',
    body: P(`Bonjour${name ? ' ' + name : ''},`) +
      P('Vous avez commencé une réservation à La Bonne Aventure, mais le paiement n’a pas été finalisé. Voici le récapitulatif :') +
      details([
        ['Arrivée', frDate(booking.checkin)],
        ['Départ', frDate(booking.checkout)],
        ['Nuits', escH(booking.nights)],
        ['Total', euros(booking.amount_total_cents, booking.currency)],
      ]) +
      P('Ces dates ne sont pas encore bloquées pour vous et peuvent partir à tout moment.') +
      button(`${origin}/mon-compte.html`, 'Finaliser ma réservation') +
      SMALL(`Vous préférez d’autres dates ? <a href="${origin}/#booking" style="color:${C.navy}">Voir le calendrier</a>.`),
  });
  await sendResend(env, booking.email, 'Votre réservation vous attend · La Bonne Aventure', html);
  return true;
}

async function sendEmails(env, booking) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const total = euros(booking.amount_total_cents, booking.currency);
  let cautionCents = 0;
  try { const s0 = await getSettings(env); cautionCents = (s0 && s0.caution_cents) || 0; } catch (e) {}
  const send = (to, subject, html) => sendResend(env, to, subject, html);
  const n = Number(booking.nights) || 0;
  const nights = n + ' nuit' + (n > 1 ? 's' : '');
  const voyageurs = (booking.guests || 1) + ' adulte' + ((booking.guests || 1) > 1 ? 's' : '') + (booking.dog ? ' + chien' : '');

  const guestHtml = layout({
    preheader: `Votre séjour du ${frDate(booking.checkin, true)} au ${frDate(booking.checkout, true)} est confirmé.`,
    kicker: 'Réservation confirmée',
    title: 'Merci, votre séjour est réservé',
    body: P(`Bonjour ${firstName(booking.guest_name)},`) +
      P('Votre réservation à La Bonne Aventure est confirmée. Voici le récapitulatif :') +
      details([
        ['Arrivée', frDate(booking.checkin) + '<br><span style="font-weight:400;color:' + C.mute + '">à partir de 16 h</span>'],
        ['Départ', frDate(booking.checkout) + '<br><span style="font-weight:400;color:' + C.mute + '">avant 10 h</span>'],
        ['Séjour', nights + ' · ' + voyageurs],
        ['Total réglé', total],
      ]) +
      (cautionCents > 0 ? note(`<b>Caution :</b> une empreinte bancaire de ${euros(cautionCents, booking.currency)} est enregistrée. Rien n’est prélevé, sauf en cas de dégât constaté après votre séjour.`) : '') +
      P('La veille de votre arrivée, je vous envoie le code de la boîte à clés et toutes les infos pratiques.') +
      (env.SITE_URL ? button(`${env.SITE_URL}/mon-compte.html`, 'Voir ma réservation') : ''),
  });

  const hostHtml = layout({
    audience: 'team',
    preheader: `${booking.guest_name} · ${frDate(booking.checkin, true)} → ${frDate(booking.checkout, true)} · ${total}`,
    kicker: 'Nouvelle réservation directe',
    title: escH(booking.guest_name || 'Nouveau voyageur'),
    body: details([
      ['Dates', frDate(booking.checkin, true) + ' → ' + frDate(booking.checkout, true) + ' (' + nights + ')'],
      ['Voyageurs', voyageurs],
      ['Montant', total],
      ['Email', escH(booking.email || '—')],
      ['Téléphone', escH(booking.phone || '—')],
    ]) + SMALL('Les dates sont bloquées automatiquement sur Airbnb (sous 3 h environ).') +
      button(`${SITE}/admin#book`, 'Ouvrir mes séjours'),
  });

  await Promise.all([
    send(booking.email, `Réservation confirmée · du ${frDate(booking.checkin, true)} au ${frDate(booking.checkout, true)}`, guestHtml),
    env.HOST_EMAIL ? send(env.HOST_EMAIL, `Nouvelle réservation · ${booking.guest_name} · ${frDate(booking.checkin, true)} → ${frDate(booking.checkout, true)}`, hostHtml) : null,
  ]);

  // Équipe ménage (adresses réglées dans l'admin).
  try {
    const list = await cleaningRecipients(env);
    if (list.length) {
      const cleanHtml = layout({
        audience: 'team',
        preheader: `Ménage le ${frDate(booking.checkout)} après 10 h.`,
        kicker: 'Ménage à prévoir',
        title: 'Ménage le ' + frDate(booking.checkout, true),
        body: P('Une nouvelle réservation vient d’être confirmée :') +
          details([
            ['Arrivée', frDate(booking.checkin) + ' · dès 16 h'],
            ['Départ', frDate(booking.checkout) + ' · avant 10 h'],
            ['Séjour', nights + ' · ' + voyageurs],
          ]) + P('Merci de prévoir le ménage le jour du départ, entre 10 h et 16 h.'),
      });
      await Promise.all(list.map((to) => send(to, `Ménage à prévoir · ${frDate(booking.checkout, true)}`, cleanHtml)));
    }
  } catch (e) { /* pas bloquant */ }
}

async function cleaningRecipients(env) {
  try {
    const s = await getSettings(env);
    return ((s && s.cleaning_emails) || '').split(/[\n,; ]+/).map((x) => x.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

/** Destinataires validation extras = hôte + même liste « équipe ménage ». */
async function extraApprovalRecipients(env) {
  const list = [];
  if (env.HOST_EMAIL) list.push(env.HOST_EMAIL);
  for (const e of await cleaningRecipients(env)) {
    if (!list.includes(e)) list.push(e);
  }
  return list;
}

function fmtEuro(cents, currency = 'eur') {
  return euros(cents, currency);
}

function extraKindLabel(kind) {
  if (kind === 'early_checkin') return 'Arrivée anticipée (dès 12 h)';
  if (kind === 'late_checkout') return 'Départ tardif (jusqu’à 14 h)';
  return kind || 'Extra';
}
// « sam. 12 déc. » dans un libellé de dates déjà calculé (ex. « Départ 2026-12-12 »).
const prettyDates = (label) => escH(String(label || '')).replace(/\d{4}-\d{2}-\d{2}/g, (d) => frDate(d, true));

/** Demande de validation → hôte + femme de ménage. */
export async function sendExtraApprovalRequest(env, info, urls) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const html = layout({
    audience: 'team',
    preheader: `${info.guest_name || 'Un voyageur'} demande : ${info.title || 'un extra'}.`,
    kicker: 'Demande à valider',
    title: escH(info.title || 'Extra demandé'),
    body: P('Un voyageur demande un horaire flexible. Merci d’accepter ou de refuser pour que le ménage puisse s’organiser.') +
      details([
        ['Quand', prettyDates(info.dates_label) || '—'],
        ['Voyageur', escH(info.guest_name || '—')],
        ['Montant', fmtEuro(info.amount_cents, info.currency)],
      ]) +
      twoButtons({ href: urls.acceptUrl, label: 'Accepter', bg: C.navy }, { href: urls.rejectUrl, label: 'Refuser', color: C.no }) +
      SMALL('Une page de confirmation s’ouvre avant de valider, pour éviter qu’un aperçu automatique du mail ne réponde à votre place. Si vous acceptez, le voyageur reçoit son lien de paiement. Vous pouvez aussi répondre depuis l’espace ménage.'),
  });
  const subject = `À valider · ${info.title || 'Extra'} · ${info.guest_name || ''}`.trim();
  const recipients = await extraApprovalRecipients(env);
  await Promise.all(recipients.map((to) => sendResend(env, to, subject, html)));
}

/** Accusé de réception voyageur (demande envoyée, pas encore de paiement). */
export async function sendExtraRequestAck(env, info) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !info.email) return;
  const html = layout({
    preheader: 'Votre demande est bien reçue. Réponse très vite.',
    kicker: 'Demande reçue',
    title: escH(info.title || 'Votre demande'),
    body: P(`Bonjour ${firstName(info.guest_name)},`) +
      P('Votre demande est bien reçue. Je vérifie avec le planning du ménage et je reviens vers vous très vite.') +
      details([
        ['Quand', prettyDates(info.dates_label) || '—'],
        ['Montant', fmtEuro(info.amount_cents, info.currency)],
      ]) +
      P('Si elle est acceptée, vous recevrez un mail avec un lien de paiement sécurisé. Rien n’est débité d’ici là.'),
  });
  await sendResend(env, info.email, `Demande reçue · ${info.title || 'Extra'}`, html);
}

/** Après acceptation : lien de paiement au voyageur. Renvoie le résultat Resend. */
export async function sendExtraPayLink(env, order, payUrl) {
  if (!order || !order.email || !payUrl) {
    return { ok: false, message: 'Email ou lien de paiement manquant.' };
  }
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
    return { ok: false, message: 'Email non configuré (RESEND / FROM_EMAIL).' };
  }
  const html = layout({
    preheader: 'Bonne nouvelle : votre demande est acceptée.',
    kicker: 'Demande acceptée',
    title: 'Bonne nouvelle, c’est d’accord',
    body: P(`Bonjour ${firstName(order.guest_name)},`) +
      P(`Votre demande <b>${escH(order.title || 'extra')}</b> est acceptée. Il ne reste qu’à la régler pour la confirmer.`) +
      details([
        ['Quand', prettyDates(order.dates_label) || '—'],
        ['Montant', fmtEuro(order.amount_cents, order.currency)],
      ]) +
      button(payUrl, 'Payer en ligne') +
      SMALL('Paiement sécurisé par Stripe. Ce lien vous est personnel. Une fois réglé, vos nouveaux horaires apparaissent aussi dans votre livret d’accueil.'),
  });
  return sendResend(env, order.email, `Demande acceptée · ${order.title || 'Extra'}`, html);
}

/** Refus : informer le voyageur. */
export async function sendExtraRejected(env, order) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !order || !order.email) return;
  const html = layout({
    preheader: 'Votre demande n’a pas pu être acceptée cette fois.',
    kicker: 'Votre demande',
    title: 'Désolé, ce n’est pas possible cette fois',
    body: P(`Bonjour ${firstName(order.guest_name)},`) +
      P(`Votre demande <b>${escH(order.title || 'extra')}</b> n’a pas pu être acceptée : le planning du ménage ne le permet pas ce jour-là. Rien ne vous a été débité.`) +
      details([['Arrivée', 'à partir de 16 h'], ['Départ', 'avant 10 h']]) +
      P('N’hésitez pas à me répondre si vous avez une contrainte particulière, je ferai au mieux.'),
  });
  await sendResend(env, order.email, `Votre demande · ${order.title || 'Extra'}`, html);
}

async function sendExtraEmails(env, order) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL) return;
  const total = euros(order.amount_cents, order.currency);
  const hours = order.kind === 'early_checkin'
    ? 'Vous pouvez arriver dès <b>12 h</b>.'
    : order.kind === 'late_checkout'
      ? 'Vous pouvez partir jusqu’à <b>14 h</b>.'
      : '';
  const day = order.service_date ? frDate(order.service_date) : '—';

  const guestHtml = layout({
    preheader: `${order.title} confirmé${order.service_date ? ' pour le ' + frDate(order.service_date, true) : ''}.`,
    kicker: 'Extra confirmé',
    title: escH(order.title || 'Votre extra') + ', c’est confirmé',
    body: P(`Bonjour ${firstName(order.guest_name)},`) +
      P(`Votre paiement est bien reçu. ${hours} Ces horaires apparaissent aussi dans votre livret d’accueil.`) +
      details([['Jour', day], ['Montant réglé', total]]),
  });

  const hostHtml = layout({
    audience: 'team',
    preheader: `${order.guest_name || 'Un voyageur'} a payé ${total}.`,
    kicker: 'Extra payé',
    title: escH(order.title || 'Extra') + ' · ' + total,
    body: details([
      ['Type', extraKindLabel(order.kind)],
      ['Jour', day],
      ['Voyageur', escH(order.guest_name || '—')],
      ['Email', escH(order.email || '—')],
    ]),
  });

  const cleanHtml = layout({
    audience: 'team',
    preheader: `${extraKindLabel(order.kind)} le ${order.service_date ? frDate(order.service_date, true) : ''}.`,
    kicker: 'Horaire confirmé',
    title: escH(extraKindLabel(order.kind)),
    body: P('Le voyageur a payé, le créneau est confirmé :') +
      details([['Jour', day], ['Voyageur', firstName(order.guest_name) || '—']]) +
      P('Merci d’adapter le passage du ménage.'),
  });

  const jobs = [];
  if (order.email) jobs.push(sendResend(env, order.email, `C’est confirmé · ${order.title || 'Extra'}`, guestHtml));
  if (env.HOST_EMAIL) jobs.push(sendResend(env, env.HOST_EMAIL, `Extra payé · ${order.title || 'Extra'} · ${total}`, hostHtml));
  const cleaners = await cleaningRecipients(env);
  for (const to of cleaners) {
    jobs.push(sendResend(env, to, `Horaire confirmé · ${order.title || 'Extra'}${order.service_date ? ' · ' + frDate(order.service_date, true) : ''}`, cleanHtml));
  }
  await Promise.all(jobs);
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
  // Paiement Stripe reçu : on confirme même si un préchargement email avait mis « cancelled ».
  await confirmExtraOrder(env, orderId);
  if (order.stripe_session_id) await confirmExtraOrdersBySession(env, order.stripe_session_id);
  const fresh = await getExtraOrder(env, orderId);
  const confirmed = fresh && fresh.status === 'confirmed' ? fresh : { ...order, status: 'confirmed' };
  await sendExtraEmails(env, confirmed);
  return confirmed;
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

// Stock bas : un produit vient de passer sous son seuil d'alerte.
export async function sendStockAlert(env, item, who) {
  if (!env.HOST_EMAIL) return { ok: false, message: 'HOST_EMAIL manquant.' };
  const unit = item.unit ? ' · ' + escH(item.unit) : '';
  const html = layout({
    audience: 'team',
    preheader: item.qty === 0 ? `Plus de ${item.name} au studio.` : `Il reste ${item.qty} ${item.name}.`,
    kicker: 'Stock bas',
    title: escH(item.name),
    body: details([
      ['Il reste', item.qty === 0 ? `<span style="color:${C.no}">plus rien</span>` : item.qty + unit],
      ['Seuil d’alerte', escH(item.threshold)],
      ['Signalé par', who === 'menage' ? 'votre femme de ménage' : 'vous'],
    ]) + P('Pensez à en racheter. Une fois les courses faites, ajoutez-les dans votre stock.') +
      button(`${SITE}/admin#stock`, 'Voir mon stock'),
  });
  return sendResend(env, env.HOST_EMAIL, `Stock bas · ${item.name} (reste ${item.qty})`, html);
}
