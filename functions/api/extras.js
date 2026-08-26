// GET /api/extras — liste publique des extras actifs + offres en cours.
import { listExtras, listExtraPromotions, seedPackCuristeOnce, seedFlexHoursCopyOnce } from '../_lib/db.js';

function matchesTarget(promo, kind) {
  const t = promo.target || 'all';
  return t === 'all' || t === kind;
}

export async function onRequestGet({ env }) {
  try { await seedPackCuristeOnce(env); } catch (e) { /* ignore */ }
  try { await seedFlexHoursCopyOnce(env); } catch (e) { /* ignore */ }
  let extras = [];
  let promotions = [];
  try { extras = await listExtras(env, true); } catch (e) { extras = []; }
  try { promotions = await listExtraPromotions(env, { liveOnly: true }); } catch (e) { promotions = []; }

  const percentPromos = promotions.filter((p) => p.kind === 'percent' && Number(p.percent) > 0);
  const packPromos = promotions.filter((p) => p.kind === 'pack_flex');

  const mapped = extras.map((x) => {
    const promo = percentPromos.find((p) => matchesTarget(p, x.kind));
    const out = {
      id: x.id,
      title: x.title,
      description: x.description,
      condition: x.condition,
      price_cents: x.price_cents,
      kind: x.kind,
    };
    if (promo) {
      const pct = Math.max(0, Math.min(100, Number(promo.percent) || 0));
      out.promo = {
        id: promo.id,
        kind: 'percent',
        percent: pct,
        title: promo.title,
      };
      out.price_cents_original = x.price_cents;
      out.price_cents = Math.max(0, Math.round(x.price_cents * (100 - pct) / 100));
    }
    return out;
  });

  // Cartes virtuelles pour les packs actifs (affichées en tête).
  const packs = packPromos.map((p) => ({
    id: 'pack:' + p.id,
    promo_id: p.id,
    title: p.title,
    description: p.message || 'Arrivée dès 12h et départ jusqu’à 14h — les deux pour le prix d’un.',
    condition: 'Sous réserve de disponibilité des deux dates',
    price_cents: Math.max(0, Math.round(Number(p.pack_price_cents) || 1500)),
    price_cents_original: Math.max(0, Math.round(Number(p.pack_price_cents) || 1500) * 2),
    kind: 'flex_pack',
    promo: { id: p.id, kind: 'pack_flex', title: p.title },
  }));

  const popup = promotions
    .filter((p) => p.show_popup)
    .map((p) => ({
      id: p.id,
      title: p.title,
      message: p.message || '',
      cta_label: p.cta_label || "Profiter de l'offre",
      kind: p.kind,
      percent: p.percent,
      pack_price_cents: p.pack_price_cents,
      valid_from: p.valid_from,
      valid_to: p.valid_to,
    }));

  return Response.json(
    { extras: packs.concat(mapped), promotions: popup, currency: 'eur' },
    { headers: { 'cache-control': 'no-store' } }
  );
}
