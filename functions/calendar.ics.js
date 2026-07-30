// GET /calendar.ics — calendrier maître (rôle « channel manager »).
// Expose TOUTES les dates occupées pour qu'une autre plateforme qui l'importe bloque tout :
//   • réservations directes confirmées   (getConfirmed)
//   • blocages manuels                    (listBlocks)
//   • dates importées d'Airbnb / externes (fetchExternalRanges)
// Option ?scope=direct → exclut les dates externes (utile pour l'import DANS Airbnb, afin de
// ne pas lui renvoyer ses propres dates). Sans paramètre = calendrier complet.
import { getConfirmed, listBlocks } from './_lib/db.js';
import { generateICal, fetchExternalRanges } from './_lib/ical.js';

export async function onRequestGet({ env, request }) {
  const scope = new URL(request.url).searchParams.get('scope');
  const includeExternal = scope !== 'direct';

  let rows = [];
  let blocks = [];
  let external = [];
  try { rows = await getConfirmed(env); } catch (err) { rows = []; }
  try { blocks = await listBlocks(env); } catch (err) { blocks = []; }
  if (includeExternal) {
    // Tolérant : en cas d'échec réseau, fetchExternalRanges renvoie [] (ou le dernier cache).
    try { external = await fetchExternalRanges(env, {}); } catch (err) { external = []; }
  }

  const events = [];
  const seen = new Set();
  const add = (from, to, uid, summary) => {
    if (!from || !to) return;
    const key = from + '|' + to + '|' + summary;
    if (seen.has(key)) return;             // dédoublonnage (une plage externe peut recouvrir une résa)
    seen.add(key);
    events.push({ uid, from, to, summary });
  };

  for (const r of rows) add(r.checkin, r.checkout, r.id, 'Réservé — La Bonne Aventure');
  for (const b of blocks) add(b.date_from, b.date_to, 'block-' + b.id, b.label ? `Indisponible — ${b.label}` : 'Indisponible');
  for (const e of external) add(e.from, e.to, `ext-${e.from}-${e.to}`, 'Réservé (import)');

  const ics = generateICal(events, { calName: 'La Bonne Aventure — Disponibilités' });
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="la-bonne-aventure.ics"',
      'cache-control': 'public, max-age=300',
    },
  });
}
