// POST /api/quote — valide les dates + code promo et calcule le prix (contrôle serveur).
import { loadSettings, loadSeasons, validatePromo, computeQuote } from '../_lib/pricing.js';
import { fetchExternalRanges } from '../_lib/ical.js';
import { getBusyRanges, overlaps } from '../_lib/db.js';

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}));
  const [settings, seasons] = await Promise.all([loadSettings(env), loadSeasons(env)]);

  const nights = (body.checkin && body.checkout)
    ? Math.round((Date.parse(body.checkout) - Date.parse(body.checkin)) / 86400000)
    : 0;
  const promoRes = await validatePromo(env, body.promo, { nights, checkin: body.checkin });
  if (!promoRes.ok) return Response.json({ ok: false, error: 'promo', message: promoRes.message }, { status: 400 });

  const quote = computeQuote(body, { settings, seasons, promo: promoRes.promo });
  if (!quote.ok) return Response.json(quote, { status: 400 });

  // Disponibilité (cache 30 min — suffisant pour un devis, revérifié au paiement).
  let blocked = [];
  try {
    const [external, busy] = await Promise.all([fetchExternalRanges(env, {}), getBusyRanges(env)]);
    blocked = [...external, ...busy];
  } catch (err) { blocked = []; }
  const conflict = blocked.some((r) => overlaps(quote.checkin, quote.checkout, r.from, r.to));
  if (conflict) {
    return Response.json({ ok: false, error: 'unavailable', message: 'Ces dates ne sont plus disponibles.' }, { status: 409 });
  }

  return Response.json(quote, { headers: { 'cache-control': 'no-store' } });
}
