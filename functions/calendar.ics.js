// GET /calendar.ics — export des réservations directes confirmées.
// C'est CETTE URL qu'on importe dans Airbnb pour bloquer automatiquement les dates.
import { getConfirmed, listBlocks } from './_lib/db.js';
import { generateICal } from './_lib/ical.js';

export async function onRequestGet({ env }) {
  let rows = [];
  let blocks = [];
  try { rows = await getConfirmed(env); } catch (err) { rows = []; }
  try { blocks = await listBlocks(env); } catch (err) { blocks = []; }

  const events = rows.map((r) => ({
    uid: r.id,
    from: r.checkin,
    to: r.checkout,
    summary: 'Réservé — La Bonne Aventure',
  })).concat(blocks.map((b) => ({
    uid: 'block-' + b.id,
    from: b.date_from,
    to: b.date_to,
    summary: b.label ? `Indisponible — ${b.label}` : 'Indisponible',
  })));

  const ics = generateICal(events, { calName: 'La Bonne Aventure — Réservations directes' });
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="la-bonne-aventure.ics"',
      'cache-control': 'public, max-age=300',
    },
  });
}
