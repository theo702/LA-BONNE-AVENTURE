// GET|POST /api/extras-approve
// Validation hôte / ménage — page de confirmation (anti préchargement Gmail des liens).
import {
  ensurePricingSchema, getExtraActionToken, consumeExtraActionToken, getExtraOrder,
  listExtraOrdersByGroup, setExtraOrdersStatus,
} from '../_lib/db.js';
import { createStripeCheckoutForOrders, extrasReturnBase } from '../_lib/extraStripe.js';
import { sendExtraPayLink, sendExtraRejected } from '../_lib/notify.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function htmlPage(title, body) {
  return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — La Bonne Aventure</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f1ece0;color:#1f2838;margin:0;padding:32px 16px}
  .card{max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;border:1px solid #e6e1d4}
  h1{font-size:20px;color:#0f2a4a;margin:0 0 10px}
  p{line-height:1.5;margin:0 0 12px;color:#5f6675}
  .meta{background:#f7f2ea;border-radius:10px;padding:12px 14px;margin:14px 0;font-size:14px;color:#1f2838}
  .meta b{color:#0f2a4a}
  .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
  button,.btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:600;padding:12px 20px;border-radius:999px;text-decoration:none;display:inline-block;text-align:center}
  .ok{background:#3f6b4a;color:#fff}
  .no{background:#8a3a32;color:#fff}
  .ghost{background:#e6e1d4;color:#1f2838}
</style></head><body><div class="card"><h1>${esc(title)}</h1>${body}</div></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function euros(cents) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'eur' }).format((cents || 0) / 100);
  } catch (e) {
    return ((cents || 0) / 100).toFixed(2) + ' €';
  }
}

async function loadOrders(env, tok) {
  const primary = await getExtraOrder(env, tok.order_id);
  if (!primary) return { primary: null, orders: [] };
  let orders = tok.group_id ? await listExtraOrdersByGroup(env, tok.group_id) : [];
  if (!orders.length) orders = [primary];
  return { primary, orders };
}

/** GET : affiche la confirmation — ne consomme PAS le token (évite les bots / préchargement). */
export async function onRequestGet({ env, request }) {
  await ensurePricingSchema(env);
  const url = new URL(request.url);
  const token = (url.searchParams.get('token') || '').trim();
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();
  if (!token || (action !== 'accept' && action !== 'reject')) {
    return htmlPage('Lien invalide', '<p>Ce lien de validation est incomplet.</p>');
  }

  const tok = await getExtraActionToken(env, token);
  if (!tok) {
    return htmlPage('Lien expiré', '<p>Ce lien a déjà été utilisé ou a expiré. Demandez une nouvelle validation au voyageur si besoin.</p>');
  }

  const { primary, orders } = await loadOrders(env, tok);
  if (!primary) {
    return htmlPage('Demande introuvable', '<p>La commande associée n’existe plus.</p>');
  }

  if (!orders.some((o) => o.status === 'requested')) {
    return htmlPage('Déjà traité', `<p>Cette demande a déjà été traitée (statut : <b>${esc(primary.status)}</b>).</p>`);
  }

  const datesBits = orders
    .filter((o) => o.service_date)
    .map((o) => `${o.kind === 'early_checkin' ? 'Arrivée' : 'Départ'} ${o.service_date}`)
    .join(' · ');
  const paid = orders.find((o) => (o.amount_cents || 0) > 0) || primary;
  const isAccept = action === 'accept';

  const body = `
    <p>${isAccept
      ? 'Confirmez-vous l’<b>acceptation</b> de cette demande ? Le voyageur recevra alors le lien de paiement.'
      : 'Confirmez-vous le <b>refus</b> de cette demande ? Le voyageur sera informé.'}</p>
    <div class="meta">
      <div><b>${esc(primary.title || 'Extra')}</b></div>
      <div>${esc(datesBits || '—')}</div>
      <div>${esc(primary.guest_name || '—')} · ${esc(primary.email || '—')}</div>
      <div>${esc(euros(paid.amount_cents))}</div>
    </div>
    <form method="POST" action="/api/extras-approve" class="actions">
      <input type="hidden" name="token" value="${esc(token)}">
      <input type="hidden" name="action" value="${esc(action)}">
      <button type="submit" class="${isAccept ? 'ok' : 'no'}">${isAccept ? 'Oui, accepter' : 'Oui, refuser'}</button>
      <a class="btn ghost" href="${esc(env.SITE_URL || 'https://labonneaventure-aixlesbains.fr')}/admin.html">Annuler</a>
    </form>
    <p style="font-size:12px;margin-top:18px">Cette étape évite qu’un aperçu automatique de l’email (Gmail, etc.) valide ou refuse à votre place.</p>`;

  return htmlPage(isAccept ? 'Accepter la demande' : 'Refuser la demande', body);
}

/** POST : exécute vraiment l’action (après clic humain). */
export async function onRequestPost({ env, request }) {
  await ensurePricingSchema(env);
  const ct = request.headers.get('content-type') || '';
  let token = '';
  let action = '';
  if (ct.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    token = (body.token || '').toString().trim();
    action = (body.action || '').toString().trim().toLowerCase();
  } else {
    const form = await request.formData().catch(() => null);
    token = form ? String(form.get('token') || '').trim() : '';
    action = form ? String(form.get('action') || '').trim().toLowerCase() : '';
  }

  if (!token || (action !== 'accept' && action !== 'reject')) {
    return htmlPage('Lien invalide', '<p>Requête incomplète.</p>');
  }

  const tok = await consumeExtraActionToken(env, token);
  if (!tok) {
    return htmlPage('Lien expiré', '<p>Ce lien a déjà été utilisé ou a expiré.</p>');
  }

  const { primary, orders } = await loadOrders(env, tok);
  if (!primary) {
    return htmlPage('Demande introuvable', '<p>La commande associée n’existe plus.</p>');
  }

  const ids = orders.map((o) => o.id);
  if (!orders.some((o) => o.status === 'requested')) {
    return htmlPage('Déjà traité', `<p>Statut actuel : <b>${esc(primary.status)}</b>.</p>`);
  }

  if (action === 'reject') {
    await setExtraOrdersStatus(env, ids, 'cancelled', ['requested', 'approved']);
    await sendExtraRejected(env, primary);
    return htmlPage('Demande refusée',
      `<p>La demande de <b>${esc(primary.guest_name || 'voyageur')}</b> pour « ${esc(primary.title)} » a été refusée.</p>
       <p>Un email a été envoyé au voyageur.</p>`);
  }

  await setExtraOrdersStatus(env, ids, 'approved', ['requested']);
  const paid = orders.find((o) => (o.amount_cents || 0) > 0) || primary;
  const siblings = ids.filter((id) => id !== paid.id);
  const origin = env.SITE_URL || new URL(request.url).origin;
  const returnBase = extrasReturnBase({ return_path: '/extras' });
  const datesBits = orders
    .filter((o) => o.service_date)
    .map((o) => `${o.kind === 'early_checkin' ? 'Arrivée' : 'Départ'} ${o.service_date}`)
    .join(' · ');

  // Recharger l’order payant (statut à jour) pour Stripe.
  const paidFresh = await getExtraOrder(env, paid.id) || paid;

  const stripe = await createStripeCheckoutForOrders(env, {
    paidOrder: paidFresh,
    siblingIds: siblings,
    origin,
    returnBase,
    description: datesBits,
  });

  if (!stripe.ok) {
    return htmlPage('Erreur paiement',
      `<p>La demande est acceptée, mais la session Stripe n’a pas pu être créée : ${esc(stripe.message || 'erreur')}.</p>
       <p>Contactez le voyageur (${esc(paid.email || '—')}) manuellement.</p>`);
  }

  await setExtraOrdersStatus(env, ids, 'pending', ['approved', 'requested']);
  await sendExtraPayLink(env, { ...paidFresh, dates_label: datesBits }, stripe.url);

  return htmlPage('Demande acceptée',
    `<p>La demande de <b>${esc(paid.guest_name || 'voyageur')}</b> est acceptée.</p>
     <p>Un email avec le lien de paiement lui a été envoyé (${esc(paid.email || '—')}).</p>
     <p style="font-size:13px">Vous recevrez un mail (ainsi que le ménage) dès que le paiement sera confirmé.</p>`);
}
