// GET  /api/admin/calendar → état temps réel (résas directes, blocages, Airbnb).
// POST /api/admin/calendar → actions par date : block | unblock.
import { loadSettings } from '../../_lib/pricing.js';
import { listCalendarBookings, listBlocks, blockDate, unblockDate } from '../../_lib/db.js';
import { fetchExternalRanges } from '../../_lib/ical.js';

const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export async function onRequestGet({ env }) {
  const s = await loadSettings(env);
  let bookings = [], blocks = [], external = [];
  try {
    [bookings, blocks, external] = await Promise.all([
      listCalendarBookings(env), listBlocks(env),
      fetchExternalRanges(env, {}).catch(() => []),
    ]);
  } catch (e) { /* on ne casse pas le calendrier si une source échoue */ }

  return Response.json({
    ok: true,
    minNights: s.min_nights,
    currency: s.currency,
    bookings: bookings.map((b) => ({ id: b.id, from: b.checkin, to: b.checkout, guest: b.guest_name, status: b.status })),
    blocks: (blocks || []).map((b) => ({ id: b.id, from: b.date_from, to: b.date_to, label: b.label || null })),
    external: (external || []).map((r) => ({ from: r.from, to: r.to })),
  }, { headers: { 'cache-control': 'no-store' } });
}

export async function onRequestPost({ env, request }) {
  const b = await request.json().catch(() => ({}));
  const action = (b.action || '').toString();
  const date = (b.date || '').toString();
  if (!isDate(date)) return Response.json({ ok: false, message: 'Date invalide.' }, { status: 400 });

  if (action === 'block') { await blockDate(env, date, b.label); return Response.json({ ok: true }); }
  if (action === 'unblock') { await unblockDate(env, date); return Response.json({ ok: true }); }
  return Response.json({ ok: false, message: 'Action inconnue.' }, { status: 400 });
}
