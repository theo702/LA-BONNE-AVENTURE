// /api/menage/stock — accès de la femme de ménage (lien personnel, clé dans l'en-tête).
// Elle voit la liste des produits et déclare ce qu'elle utilise. Rien d'autre.
import { listStock, applyDelta, undoMenageMove, checkMenageToken } from '../../_lib/stock.js';

const deny = () => Response.json({ ok: false, error: 'auth', message: 'Lien invalide ou expiré. Demandez un nouveau lien.' }, { status: 401 });
const pub = (items) => items.map((x) => ({ id: x.id, name: x.name, unit: x.unit, qty: x.qty, low: x.low }));

export async function onRequestGet({ request, env }) {
  if (!(await checkMenageToken(env, request.headers.get('x-menage-key')))) return deny();
  return Response.json({ ok: true, items: pub(await listStock(env)) }, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!(await checkMenageToken(env, request.headers.get('x-menage-key')))) return deny();
  let b = {};
  try { b = await request.json(); } catch (e) {}
  if (b.action === 'undo') {
    const r = await undoMenageMove(env, Number(b.move_id) || 0);
    if (r.error) return Response.json({ ok: false, message: r.error }, { status: 400 });
    return Response.json({ ok: true, items: pub(await listStock(env)) });
  }
  const qty = Math.max(1, Math.min(20, Math.round(Number(b.qty) || 1)));
  const r = await applyDelta(env, Number(b.id) || 0, -qty, 'menage', { waitUntil });
  if (r.error) return Response.json({ ok: false, message: r.error }, { status: 400 });
  return Response.json({ ok: true, move_id: r.moveId, items: pub(await listStock(env)) });
}
