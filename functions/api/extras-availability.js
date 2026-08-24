// GET /api/extras-availability?extra_id=&date=
//   OU  ?kind=early_checkin|late_checkout|both|weekly&date=&date_early=&date_late=
//   OU  ?kind=weekly&arrival_date=&departure_date=
import { getExtra } from '../_lib/db.js';
import { extraAvailable, extraAvailableBoth } from '../_lib/extraAvail.js';
import { weeklyPackQuote } from '../_lib/weeklyPack.js';

export async function onRequestGet({ env, request }) {
  const u = new URL(request.url);
  const kindParam = (u.searchParams.get('kind') || '').trim();
  let kind = kindParam;
  let extra = null;
  if (!kind) {
    extra = await getExtra(env, parseInt(u.searchParams.get('extra_id'), 10));
    if (!extra || !extra.active) return Response.json({ available: false, message: 'Extra indisponible.' });
    kind = extra.kind;
  }
  if (kind === 'both') {
    const r = await extraAvailableBoth(env, u.searchParams.get('date_late'), u.searchParams.get('date_early'));
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  }
  if (kind === 'weekly') {
    if (!extra) {
      const id = parseInt(u.searchParams.get('extra_id'), 10);
      if (id) extra = await getExtra(env, id);
    }
    const arrival = (u.searchParams.get('arrival_date')
      || u.searchParams.get('date_arrival')
      || u.searchParams.get('early_date')
      || '').trim();
    const departure = (u.searchParams.get('departure_date')
      || u.searchParams.get('date_departure')
      || u.searchParams.get('late_date')
      || '').trim();
    const unit = extra && extra.kind === 'weekly' ? extra.price_cents : 4500;
    const quote = weeklyPackQuote(arrival, departure, unit);
    if (!quote.ok) {
      return Response.json({
        available: false,
        weeks: 0,
        amount_cents: 0,
        unit_cents: quote.unit_cents,
        message: quote.message,
      }, { headers: { 'cache-control': 'no-store' } });
    }
    const label = quote.weeks === 1
      ? `1 ménage + linge · ${quote.weeks} sem.`
      : `${quote.weeks} ménages + linge · ${quote.weeks} sem.`;
    return Response.json({
      available: true,
      weeks: quote.weeks,
      amount_cents: quote.amount_cents,
      unit_cents: quote.unit_cents,
      capped: !!quote.capped,
      message: quote.capped ? quote.message : label,
    }, { headers: { 'cache-control': 'no-store' } });
  }
  if (kind !== 'late_checkout' && kind !== 'early_checkin') {
    return Response.json({ available: true });
  }
  const r = await extraAvailable(env, kind, u.searchParams.get('date'));
  return Response.json(r, { headers: { 'cache-control': 'no-store' } });
}
