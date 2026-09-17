// GET /api/extras-approve?token=…&action=accept|reject
// Validation hôte / ménage d'une demande d'arrivée anticipée ou départ tardif.
import {
  ensurePricingSchema, consumeExtraActionToken, getExtraOrder, listExtraOrdersByGroup,
  setExtraOrdersStatus,
} from '../_lib/db.js';
import { createStripeCheckoutForOrders, extrasReturnBase } from '../_lib/extraStripe.js';
import { sendExtraPayLink, sendExtraRejected } from '../_lib/notify.js';

function htmlPage(title, body) {
  return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — La Bonne Aventure</title>
<style>
  body{font-family:system-ui,sans-serif;background:#f1ece0;color:#1f2838;margin:0;padding:32px 16px}
  .card{max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px 24px;border:1px solid #e6e1d4}
  h1{font-size:20px;color:#0f2a4a;margin:0 0 10px}
  p{line-height:1.5;margin:0 0 12px;color:#5f6675}
  a{color:#0f2a4a}
</style></head><body><div class="card"><h1>${title}</h1>${body}</div></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ env, request }) {
  await ensurePricingSchema(env);
  const url = new URL(request.url);
  const token = (url.searchParams.get('token') || '').trim();
  const action = (url.searchParams.get('action') || '').trim().toLowerCase();
  if (!token || (action !== 'accept' && action !== 'reject')) {
    return htmlPage('Lien invalide', '<p>Ce lien de validation est incomplet.</p>');
  }

  const tok = await consumeExtraActionToken(env, token);
  if (!tok) {
    return htmlPage('Lien expiré', '<p>Ce lien a déjà été utilisé ou a expiré. Si besoin, redemandez au voyageur de faire une nouvelle demande.</p>');
  }

  const primary = await getExtraOrder(env, tok.order_id);
  if (!primary) {
    return htmlPage('Demande introuvable', '<p>La commande associée n’existe plus.</p>');
  }

  let orders = tok.group_id ? await listExtraOrdersByGroup(env, tok.group_id) : [];
  if (!orders.length) orders = [primary];
  const ids = orders.map((o) => o.id);
  const stillRequested = orders.every((o) => o.status === 'requested')
    || orders.some((o) => o.status === 'requested');
  if (!stillRequested && orders.every((o) => o.status !== 'requested')) {
    return htmlPage('Déjà traité', `<p>Cette demande a déjà été traitée (statut actuel : <b>${primary.status}</b>).</p>`);
  }

  if (action === 'reject') {
    await setExtraOrdersStatus(env, ids, 'cancelled', ['requested', 'approved']);
    await sendExtraRejected(env, primary);
    return htmlPage('Demande refusée',
      `<p>La demande de <b>${primary.guest_name || 'voyageur'}</b> pour « ${primary.title} » a été refusée.</p>
       <p>Un email a été envoyé au voyageur.</p>`);
  }

  // accept
  await setExtraOrdersStatus(env, ids, 'approved', ['requested']);
  const paid = orders.find((o) => (o.amount_cents || 0) > 0) || primary;
  const siblings = ids.filter((id) => id !== paid.id);
  const origin = env.SITE_URL || url.origin;
  const returnBase = extrasReturnBase({ return_path: '/extras' });

  const datesBits = orders
    .filter((o) => o.service_date)
    .map((o) => `${o.kind === 'early_checkin' ? 'Arrivée' : 'Départ'} ${o.service_date}`)
    .join(' · ');

  const stripe = await createStripeCheckoutForOrders(env, {
    paidOrder: paid,
    siblingIds: siblings,
    origin,
    returnBase,
    description: datesBits,
  });

  if (!stripe.ok) {
    return htmlPage('Erreur paiement',
      `<p>La demande est acceptée, mais la session Stripe n’a pas pu être créée : ${stripe.message || 'erreur'}.</p>
       <p>Contactez le voyageur (${paid.email || '—'}) manuellement.</p>`);
  }

  // Passe en pending (attente de paiement Stripe).
  await setExtraOrdersStatus(env, ids, 'pending', ['approved', 'requested']);
  await sendExtraPayLink(env, { ...paid, dates_label: datesBits }, stripe.url);

  return htmlPage('Demande acceptée',
    `<p>La demande de <b>${paid.guest_name || 'voyageur'}</b> est acceptée.</p>
     <p>Un email avec le lien de paiement lui a été envoyé (${paid.email || '—'}).</p>
     <p style="font-size:13px">Vous recevrez un mail (ainsi que le ménage) dès que le paiement sera confirmé.</p>`);
}
