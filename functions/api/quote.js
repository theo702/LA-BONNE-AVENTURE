// POST /api/quote — valide les dates et calcule le prix (contrôle serveur).
import { getPricing, computeQuote } from '../_lib/pricing.js';
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges, overlaps } from '../_lib/db.js';

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const p = getPricing(env);

  const quote = computeQuote(body, p);
  if (!quote.ok) return Response.json(quote, { status: 400 });

  // Disponibilité (cache 30 min — suffisant pour un devis, revérifié au paiement).
  let blocked = [];
  try {
    const [external, busy] = await Promise.all([
      fetchExternalRanges(env, {}),
      getBusyRanges(env),
    ]);
    blocked = [...external, ...busy];
  } catch (err) {
    blocked = [];
  }
  const conflict = blocked.some((r) => overlaps(quote.checkin, quote.checkout, r.from, r.to));
  if (conflict) {
    return Response.json(
      { ok: false, error: 'unavailable', message: 'Ces dates ne sont plus disponibles.' },
      { status: 409 }
    );
  }

  return Response.json(quote, { headers: { 'cache-control': 'no-store' } });
}
