// GET /calendar.ics — export des réservations directes confirmées.
// C'est CETTE URL qu'on importe dans Airbnb pour bloquer automatiquement les dates.
import { getConfirmed } from './_lib/db.js';
import { generateICal } from './_lib/ical.js';

export async function onRequestGet({ env }) {
  let rows = [];
  try {
    rows = await getConfirmed(env);
  } catch (err) {
    rows = [];
  }
  const events = rows.map((r) => ({
    uid: r.id,
    from: r.checkin,
    to: r.checkout,
    summary: 'Réservé — La Bonne Aventure',
  }));

  const ics = generateICal(events, { calName: 'La Bonne Aventure — Réservations directes' });
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="la-bonne-aventure.ics"',
      'cache-control': 'public, max-age=300',
    },
  });
}
