// GET /api/extras — liste publique des extras actifs.
import { listExtras } from '../_lib/db.js';

export async function onRequestGet({ env }) {
  let extras = [];
  try { extras = await listExtras(env, true); } catch (e) { extras = []; }
  return Response.json(
    { extras: extras.map((x) => ({ id: x.id, title: x.title, description: x.description, condition: x.condition, price_cents: x.price_cents, kind: x.kind })), currency: 'eur' },
    { headers: { 'cache-control': 'no-store' } }
  );
}
