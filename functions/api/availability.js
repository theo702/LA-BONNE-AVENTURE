// GET /api/availability — plages occupées (Airbnb ⋃ réservations directes) + réglages.
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges, seedTierPricingOnce, ensurePricingSchema } from '../_lib/db.js';
import { loadSettings, defaults } from '../_lib/pricing.js';

export async function onRequestGet({ env }) {
  try {
    await ensurePricingSchema(env);
    await seedTierPricingOnce(env);
    const s = await loadSettings(env);

    const [extRes, busyRes] = await Promise.allSettled([
      fetchExternalRanges(env, {}),
      getBusyRanges(env),
    ]);
    const external = extRes.status === 'fulfilled' ? (extRes.value || []) : [];
    const busy = busyRes.status === 'fulfilled' ? (busyRes.value || []) : [];
    const blocked = [...external, ...busy].filter((r) => r && r.from && r.to);

    return Response.json(
      {
        blocked,
        minNights: s.min_nights,
        maxGuests: s.max_guests,
        nightlyCents: s.nightly_cents,
        currency: s.currency,
        weekTotalCents: s.week_total_cents,
        cureTotalCents: s.cure_total_cents,
        weeklyMinNights: s.weekly_min_nights,
        monthlyMinNights: s.monthly_min_nights,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (err) {
    const d = defaults(env);
    return Response.json(
      {
        blocked: [],
        minNights: d.min_nights,
        maxGuests: d.max_guests,
        nightlyCents: d.nightly_cents,
        currency: d.currency,
        weekTotalCents: d.week_total_cents,
        cureTotalCents: d.cure_total_cents,
        weeklyMinNights: d.weekly_min_nights,
        monthlyMinNights: d.monthly_min_nights,
      },
      { headers: { 'cache-control': 'no-store' } }
    );
  }
}
