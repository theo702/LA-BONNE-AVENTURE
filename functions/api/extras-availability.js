// GET /api/extras-availability?extra_id=&date= — un extra est-il dispo à cette date ?
import { getExtra } from '../_lib/db.js';
import { extraAvailable } from '../_lib/extraAvail.js';

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const extra = await getExtra(env, parseInt(u.searchParams.get('extra_id'), 10));
  if (!extra || !extra.active) return Response.json({ available: false, message: 'Extra indisponible.' });
  const r = await extraAvailable(env, extra.kind, u.searchParams.get('date'));
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
