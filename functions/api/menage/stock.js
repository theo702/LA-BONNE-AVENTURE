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
    const ids = (Array.isArray(b.move_ids) ? b.move_ids : [b.move_id]).map((x) => Number(x) || 0).filter(Boolean).slice(0, 50);
    let err = null;
    for (const id of ids) { const r = await undoMenageMove(env, id); if (r.error) err = r.error; }
    if (err && ids.length === 1) return Response.json({ ok: false, message: err }, { status: 400 });
    return Response.json({ ok: true, items: pub(await listStock(env)) });
  }
  // Fin de ménage : plusieurs produits d'un coup ({ lines: [{ id, qty }] }).
  if (b.action === 'batch') {
    const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 50)
      .map((l) => ({ id: Number(l && l.id) || 0, qty: Math.max(0, Math.min(500, Math.round(Number(l && l.qty) || 0))) }))
      .filter((l) => l.id && l.qty);
    if (!lines.length) return Response.json({ ok: false, message: 'Rien à enregistrer.' }, { status: 400 });
    const moveIds = [];
    for (const l of lines) {
      const r = await applyDelta(env, l.id, -l.qty, 'menage', { waitUntil });
      if (r.moveId) moveIds.push(r.moveId);
    }
    return Response.json({ ok: true, move_ids: moveIds, items: pub(await listStock(env)) });
  }
  const qty = Math.max(1, Math.min(20, Math.round(Number(b.qty) || 1)));
  const r = await applyDelta(env, Number(b.id) || 0, -qty, 'menage', { waitUntil });
  if (r.error) return Response.json({ ok: false, message: r.error }, { status: 400 });
  return Response.json({ ok: true, move_id: r.moveId, items: pub(await listStock(env)) });
}
