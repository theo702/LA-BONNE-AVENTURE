// GET /api/extras-availability?extra_id=&date=  OU  ?kind=early_checkin|late_checkout|both&date=&date_early=&date_late=
import { getExtra } from '../_lib/db.js';
import { extraAvailable, extraAvailableBoth } from '../_lib/extraAvail.js';

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const kindParam = (u.searchParams.get('kind') || '').trim();
  let kind = kindParam;
  if (!kind) {
    const extra = await getExtra(env, parseInt(u.searchParams.get('extra_id'), 10));
    if (!extra || !extra.active) return Response.json({ available: false, message: 'Extra indisponible.' });
    kind = extra.kind;
  }
  if (kind === 'both') {
    const r = await extraAvailableBoth(env, u.searchParams.get('date_late'), u.searchParams.get('date_early'));
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  }
  if (kind !== 'late_checkout' && kind !== 'early_checkin') {
    return Response.json({ available: true });
  }
  const r = await extraAvailable(env, kind, u.searchParams.get('date'));
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
