// GET /api/availability — plages occupées (Airbnb ⋃ réservations directes) + tarifs.
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges } from '../_lib/db.js';
import { getPricing } from '../_lib/pricing.js';

export async function onRequestGet({ env }) {
  const p = getPricing(env);
  let external = [];
  let busy = [];
  try {
    [external, busy] = await Promise.all([
      fetchExternalRanges(env, {}),
      getBusyRanges(env),
    ]);
  } catch (err) {
    // On ne casse pas le calendrier si une source échoue : on renvoie ce qu'on a.
  }
  const blocked = [...external, ...busy].filter((r) => r.from && r.to);

  return Response.json(
    {
      blocked,
      minNights: p.minNights,
      maxGuests: p.maxGuests,
      nightlyCents: p.nightlyCents,
      cleaningCents: p.cleaningCents,
      taxeCents: p.taxePerPersonPerNightCents,
      currency: p.currency,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
