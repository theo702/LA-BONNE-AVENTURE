// GET /api/availability — plages occupées (Airbnb ⋃ réservations directes) + réglages.
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges } from '../_lib/db.js';
import { loadSettings, loadSeasons } from '../_lib/pricing.js';

export async function onRequestGet({ env }) {
  const s = await loadSettings(env);
  let external = [];
  let busy = [];
  let seasons = [];
  try {
    [external, busy, seasons] = await Promise.all([
      fetchExternalRanges(env, {}),
      getBusyRanges(env),
      loadSeasons(env),
    ]);
  } catch (err) { /* on ne casse pas le calendrier si une source échoue */ }
  const blocked = [...external, ...busy].filter((r) => r.from && r.to);

  return Response.json(
    {
      blocked,
      minNights: s.min_nights,
      maxGuests: s.max_guests,
      nightlyCents: s.nightly_cents,
      cleaningCents: s.cleaning_cents,
      currency: s.currency,
      // Prix par date/période → toujours renvoyés (affichage sur le calendrier).
      seasons: (seasons || []).map((x) => ({ date_from: x.date_from, date_to: x.date_to, nightly_cents: x.nightly_cents })),
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
