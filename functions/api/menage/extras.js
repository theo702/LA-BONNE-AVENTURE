// /api/menage/extras — demandes d'extras (arrivée anticipée, départ tardif…) pour la
// femme de ménage : elle accepte ou refuse depuis sa page, et voit ceux déjà prévus.
// L'acceptation/le refus passe par EXACTEMENT la même logique que le lien du mail
// (/api/extras-approve) : lien de paiement au voyageur, mail de refus, etc.
import { checkMenageToken } from '../../_lib/stock.js';
import { ensurePricingSchema, listExtraOrders, getExtraOrder, createExtraActionToken, getConfirmed } from '../../_lib/db.js';
import { fetchExternalRanges } from '../../_lib/ical.js';
import { onRequestPost as approvePost } from '../extras-approve.js';

const deny = () => Response.json({ ok: false, error: 'auth', message: 'Lien invalide ou expiré. Demandez un nouveau lien.' }, { status: 401 });
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Voyageur';
const todayIso = () => new Date().toISOString().slice(0, 10);

function kindLabel(o) {
  if (o.kind === 'early_checkin') return 'Arrivée anticipée';
  if (o.kind === 'late_checkout') return 'Départ tardif';
  return o.title || 'Extra';
}

// Regroupe les commandes d'une même demande (ex. arrivée anticipée + départ tardif).
function groups(orders) {
  const map = new Map();
  for (const o of orders) {
    const k = o.group_id || o.id;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(o);
  }
  return [...map.values()].map((list) => {
    const main = list.find((o) => (o.amount_cents || 0) > 0) || list[0];
    const lines = list
      .filter((o) => o.service_date)
      .sort((a, b) => (a.service_date < b.service_date ? -1 : 1))
      .map((o) => ({ label: kindLabel(o), date: o.service_date }));
    const first = lines.length ? lines[0].date : null;
    return { id: main.id, title: main.title || 'Extra', guest: firstName(main.guest_name), lines, date: first, status: main.status, created_at: main.created_at };
  });
}

// Ménages à venir : chaque fin de séjour (site + Airbnb), avec l'heure de départ
// (10 h, ou 14 h si départ tardif) et la prochaine arrivée (16 h, ou 12 h si anticipée).
async function cleanings(env, extras, t) {
  const [direct, ext] = await Promise.all([
    getConfirmed(env).catch(() => []),
    fetchExternalRanges(env).catch(() => []),
  ]);
  const stays = [];
  for (const b of direct) if (b.checkin && b.checkout) stays.push({ from: b.checkin, to: b.checkout });
  for (const r of ext) if (r.from && r.to && !r.blocked) stays.push({ from: r.from, to: r.to });
  stays.sort((a, b) => (a.from < b.from ? -1 : 1));
  const live = extras.filter((o) => ['approved', 'pending', 'confirmed'].includes(o.status));
  const late = (d) => live.find((o) => o.kind === 'late_checkout' && o.service_date === d);
  const early = (d) => live.find((o) => o.kind === 'early_checkin' && o.service_date === d);
  const horizon = new Date(Date.parse(t + 'T00:00:00Z') + 45 * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  const out = [];
  for (const s of stays) {
    if (s.to < t || s.to > horizon || seen.has(s.to)) continue;
    seen.add(s.to);
    const l = late(s.to);
    const next = stays.find((x) => x.from >= s.to);
    const sameDay = next && next.from === s.to;
    const e = next ? early(next.from) : null;
    out.push({
      date: s.to,
      nights: Math.round((Date.parse(s.to) - Date.parse(s.from)) / 86400000),
      out_time: l ? '14 h' : '10 h',
      late: !!l,
      late_paid: !!(l && l.status === 'confirmed'),
      next_date: next ? next.from : null,
      next_time: next ? (e ? '12 h' : '16 h') : null,
      next_same_day: !!sameDay,
      next_early: !!e,
    });
    if (out.length >= 12) break;
  }
  return out;
}

async function state(env) {
  await ensurePricingSchema(env);
  const all = await listExtraOrders(env, 300);
  const t = todayIso();
  const pending = groups(all.filter((o) => o.status === 'requested'))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const planned = groups(all.filter((o) => ['approved', 'pending', 'confirmed'].includes(o.status) && o.service_date && o.service_date >= t))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(0, 20);
  return { ok: true, pending, planned, cleanings: await cleanings(env, all, t) };
}

export async function onRequestGet({ request, env }) {
  if (!(await checkMenageToken(env, request.headers.get('x-menage-key')))) return deny();
  return Response.json(await state(env), { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  if (!(await checkMenageToken(env, request.headers.get('x-menage-key')))) return deny();
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const action = b.action === 'accept' ? 'accept' : b.action === 'reject' ? 'reject' : null;
  if (!action) return Response.json({ ok: false, message: 'Action inconnue.' }, { status: 400 });
  const order = await getExtraOrder(env, String(b.id || ''));
  if (!order) return Response.json({ ok: false, message: 'Demande introuvable.' }, { status: 404 });
  if (order.status !== 'requested') {
    return Response.json({ ok: false, message: 'Cette demande a déjà été traitée.', ...(await state(env)) }, { status: 409 });
  }
  const token = await createExtraActionToken(env, order.id, order.group_id, 1);
  const origin = new URL(request.url).origin;
  await approvePost({
    ...ctx,
    request: new Request(origin + '/api/extras-approve', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, action }),
    }),
  });
  const after = await getExtraOrder(env, order.id);
  let message;
  if (action === 'reject') message = 'Demande refusée. Le voyageur est prévenu.';
  else if (after && after.status === 'pending') message = 'Demande acceptée. Le voyageur a reçu le lien de paiement.';
  else message = 'Demande acceptée, mais le lien de paiement n’a pas pu partir. Prévenez Théo.';
  return Response.json({ message, ...(await state(env)) });
}
