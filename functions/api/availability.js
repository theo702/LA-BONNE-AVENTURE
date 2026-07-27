// GET /api/availability — plages occupées (Airbnb ⋃ réservations directes) + réglages.
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges, seedTierPricingOnce } from '../_lib/db.js';
import { loadSettings } from '../_lib/pricing.js';

export async function onRequestGet({ env }) {
  await seedTierPricingOnce(env); // applique une fois les tarifs par durée si base au tarif d'usine
  const s = await loadSettings(env);
  let external = [];
  let busy = [];
  try {
    [external, busy] = await Promise.all([
      fetchExternalRanges(env, {}),
      getBusyRanges(env),
    ]);
  } catch (err) { /* on ne casse pas le calendrier si une source échoue */ }
  const blocked = [...external, ...busy].filter((r) => r.from && r.to);

  return Response.json(
    {
      blocked,
      minNights: s.min_nights,
      maxGuests: s.max_guests,
      nightlyCents: s.nightly_cents,
      currency: s.currency,
      // Paliers par durée (totaux) → estimation locale immédiate côté widget.
      weekTotalCents: s.week_total_cents,
      cureTotalCents: s.cure_total_cents,
      weeklyMinNights: s.weekly_min_nights,
      monthlyMinNights: s.monthly_min_nights,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
