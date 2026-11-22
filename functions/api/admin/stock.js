// GET/POST /api/admin/stock — stock des consommables + lien d'accès ménage.
import {
  listStock, listMoves, createItem, updateItem, deleteItem, applyDelta,
  getMenageToken, rotateMenageToken, revokeMenageToken,
} from '../../_lib/stock.js';

async function state(env) {
  const [items, moves, token] = await Promise.all([listStock(env), listMoves(env, 30), getMenageToken(env)]);
  return { ok: true, items, moves, menage_token: token, alert_email: env.HOST_EMAIL || null };
}

export async function onRequestGet({ env }) {
  return Response.json(await state(env), { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b = {};
  try { b = await request.json(); } catch (e) {}
  const id = Number(b.id) || 0;
  let res = {};
  switch (b.action) {
    case 'create': res = await createItem(env, b); break;
    case 'update': res = await updateItem(env, id, b); break;
    case 'delete': res = await deleteItem(env, id); break;
    case 'adjust': res = await applyDelta(env, id, b.delta, 'hote', { waitUntil }); break;
    case 'token': await rotateMenageToken(env); break;
    case 'revoke': await revokeMenageToken(env); break;
    default: res = { error: 'Action inconnue.' };
  }
  if (res && res.error) return Response.json({ ok: false, message: res.error }, { status: 400 });
  return Response.json(await state(env));
}
