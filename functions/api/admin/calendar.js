// GET  /api/admin/calendar → état temps réel (résas directes, blocages, Airbnb, prix/jour).
// POST /api/admin/calendar → actions par date : block | unblock | setPrice | clearPrice.
import { loadSettings, loadSeasons } from '../../_lib/pricing.js';
import {
  listCalendarBookings, listBlocks,
  setDatePrice, clearDatePrice, blockDate, unblockDate,
} from '../../_lib/db.js';
import { fetchExternalRanges } from '../../_lib/ical.js';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function onRequestGet({ env }) {
  const s = await loadSettings(env);
  let bookings = [], blocks = [], seasons = [], external = [];
  try {
    [bookings, blocks, seasons, external] = await Promise.all([
      listCalendarBookings(env), listBlocks(env), loadSeasons(env),
      fetchExternalRanges(env, {}).catch(() => []),
    ]);
  } catch (e) { /* on ne casse pas le calendrier si une source échoue */ }

  return Response.json({
    ok: true,
    baseCents: s.nightly_cents,
    minNights: s.min_nights,
    currency: s.currency,
    dynamicEnabled: !!s.dynamic_pricing_enabled,
    bookings: bookings.map((b) => ({ id: b.id, from: b.checkin, to: b.checkout, guest: b.guest_name, status: b.status })),
    blocks: (blocks || []).map((b) => ({ id: b.id, from: b.date_from, to: b.date_to, label: b.label || null })),
    external: (external || []).map((r) => ({ from: r.from, to: r.to })),
    seasons: (seasons || []).map((x) => ({ date_from: x.date_from, date_to: x.date_to, nightly_cents: x.nightly_cents })),
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const action = (b.action || '').toString();
  const date = (b.date || '').toString();
  if (!isDate(date)) return Response.json({ ok: false, message: 'Date invalide.' }, { status: 400 });

  if (action === 'block') { await blockDate(env, date, b.label); return Response.json({ ok: true }); }
  if (action === 'unblock') { await unblockDate(env, date); return Response.json({ ok: true }); }
  if (action === 'setPrice') {
    const cents = Math.round(Number(b.price_cents) || 0);
    if (cents <= 0) return Response.json({ ok: false, message: 'Prix invalide.' }, { status: 400 });
    const min = b.min_nights ? Math.max(1, Math.round(Number(b.min_nights))) : null;
    await setDatePrice(env, date, cents, min);
    return Response.json({ ok: true });
  }
  if (action === 'clearPrice') { await clearDatePrice(env, date); return Response.json({ ok: true }); }
  return Response.json({ ok: false, message: 'Action inconnue.' }, { status: 400 });
}
