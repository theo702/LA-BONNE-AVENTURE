// Tarification v2 — calcul du prix côté serveur (jamais de confiance au client).
// Réglages en base D1 (table settings) + tarifs saisonniers + réductions + taxe de séjour.

import AIRBNB from './airbnb-prices.js';

// Le site suit Airbnb : chaque nuit = prix Airbnb du jour −15,5 % (les frais Airbnb), arrondi à
// l'euro. Ménage : 50 € par séjour, comme sur Airbnb. Les prix Airbnb sont relevés sur le
// calendrier hôte et enregistrés dans airbnb-prices.js (mis à jour automatiquement).
export const SITE_FACTOR = 0.845;
export const CLEANING_CENTS = 5000;
// Airbnb fait −10 % quand on réserve au moins 3 mois avant l'arrivée : le site fait pareil.
export const EARLY_MONTHS = 3, EARLY_PCT = 10;
export function siteNightCents(day, s) {
  const a = AIRBNB && AIRBNB.prices && AIRBNB.prices[day];
  return a ? Math.round((a * SITE_FACTOR) / 100) * 100 : s.nightly_cents;
}
// Prix site des prochains jours (pour l'estimation instantanée du widget).
export function sitePrices() {
  const out = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const [d, a] of Object.entries((AIRBNB && AIRBNB.prices) || {})) if (d >= today) out[d] = Math.round((a * SITE_FACTOR) / 100) * 100;
  return out;
}

// Valeurs par défaut (fallback si la table settings n'est pas encore renseignée).
export function defaults(env = {}) {
  const int = (k, d) => { const x = parseInt(env[k], 10); return Number.isFinite(x) ? x : d; };
  return {
    currency: env.CURRENCY || 'eur',
    // Tarifs par durée (ménage inclus). La semaine et la cure sont exprimées en TOTAL
    // (prix pour la durée de référence) → on obtient des totaux ronds exacts aux seuils.
    nightly_cents: int('NIGHTLY_CENTS', 5500),    // 1–5 nuits : seulement si pas de prix Airbnb pour la date
    week_total_cents: int('WEEK_TOTAL_CENTS', 30000),  // ≥ 7 nuits : 300 € la semaine
    cure_total_cents: int('CURE_TOTAL_CENTS', 75000),  // ≥ 21 nuits : 750 € la cure
    cleaning_cents: int('CLEANING_CENTS', 0),     // ménage inclus
    min_nights: int('MIN_NIGHTS', 1),
    max_guests: int('MAX_GUESTS', 2),
    // Seuils en NUITS. Une semaine = 7 jours = 6 nuits ; une cure de 3 semaines = 21 jours
    // = 20 nuits (le jour du départ ne compte pas).
    weekly_pct: 0, weekly_min_nights: 6,          // « semaine » dès 6 nuits (7 jours)
    monthly_pct: 0, monthly_min_nights: 20,       // « cure » dès 20 nuits (21 jours)
    lastmin_days: 0, lastmin_pct: 0,
    taxe_enabled: 1, taxe_rate_pct: 5.0, taxe_cap_cents: 427, taxe_additional_pct: 10.0,
    cleaning_emails: '',
    dynamic_pricing_enabled: 1,
    caution_cents: int('CAUTION_CENTS', 0),       // caution (empreinte)
    pet_fee_cents: int('PET_FEE_CENTS', 2000),    // chien : forfait par séjour (max 1 chien)
  };
}

// Charge les réglages depuis D1, complétés par les valeurs par défaut.
// Une seule fois : l'ancien tarif fixe (120 €/nuit ménage inclus) devient un simple secours
// (55 €) — le vrai prix vient d'Airbnb −15,5 %.
async function migrateAirbnbMirror(env) {
  try {
    if (!env.CACHE || (await env.CACHE.get('seed:airbnb-mirror'))) return;
    await env.DB.prepare(`UPDATE settings SET nightly_cents = 5500 WHERE id = 1`).run();
    await env.CACHE.put('seed:airbnb-mirror', '1');
  } catch (e) { /* non bloquant */ }
}

export async function loadSettings(env) {
  await migrateAirbnbMirror(env);
  const d = defaults(env);
  try {
    const row = await env.DB.prepare(`SELECT * FROM settings WHERE id = 1`).first();
    if (row) return Object.assign(d, row);
  } catch (e) { /* table absente en dev : on garde les défauts */ }
  return d;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
export function nightsBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }

// Tarif « par durée » : taux/nuit (en cents, éventuellement fractionnaire) selon le total de
// nuits. Semaine et cure sont stockées en TOTAL → on divise par le seuil de référence, ce qui
// donne des totaux ronds exacts aux seuils (7 nuits = 300 €, 21 nuits = 750 €).
function tierRate(nights, s) {
  if (s.monthly_min_nights && nights >= s.monthly_min_nights && s.cure_total_cents) {
    return s.cure_total_cents / s.monthly_min_nights;
  }
  if (s.weekly_min_nights && nights >= s.weekly_min_nights && s.week_total_cents) {
    return s.week_total_cents / s.weekly_min_nights;
  }
  return s.nightly_cents;
}

// Libellé du palier appliqué (pour l'affichage du récapitulatif).
function tierLabel(nights, s) {
  if (s.monthly_min_nights && nights >= s.monthly_min_nights && s.cure_total_cents) return 'tarif cure';
  if (s.weekly_min_nights && nights >= s.weekly_min_nights && s.week_total_cents) return 'tarif semaine';
  return null;
}

// Nuits du séjour couvertes par la période d'un code promo. La période se lit comme une
// réservation : du `valid_from` (nuit incluse) au `valid_to` (jour de départ, exclu).
// « du 12 au 14 » = nuits du 12 et du 13. Si les deux dates sont identiques : cette nuit-là.
// Sans période, toutes les nuits sont couvertes. La date à laquelle le client réserve n'entre
// pas en compte : il peut réserver quand il veut.
export function promoNights(promo, checkin, checkout) {
  const total = nightsBetween(checkin, checkout);
  if (!promo || (!promo.valid_from && !promo.valid_to)) return total;
  const from = promo.valid_from || null, to = promo.valid_to || null;
  let n = 0;
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.parse(checkin) + i * 86400000).toISOString().slice(0, 10);
    const ok = from && to && from === to ? d === from : (!from || d >= from) && (!to || d < to);
    if (ok) n++;
  }
  return n;
}
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// ---------- Tarifs événements (ex. Musilac) : prix/nuit spécial sur des dates précises ----------
// Une ligne = des nuits du `date_from` (incluse) au `date_to` (jour de départ, exclu).
async function ensureEventRates(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS event_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, date_from TEXT NOT NULL, date_to TEXT NOT NULL,
    nightly_cents INTEGER NOT NULL, min_nights INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`).run();
}
export async function loadEventRates(env) {
  try {
    await ensureEventRates(env);
    // Grille des événements (prix site = prix Airbnb −15,5 %), chargée une seule fois.
    // Airbnb : Marchés de Noël 85 €, fin d'année 90 €, réveillon 120 €, 1er janvier 95 €,
    // Saint-Valentin 90 €, Pâques 80 €, veille de Musilac 100 €, Musilac 150 €.
    if (env.CACHE && !(await env.CACHE.get('seed:events-v2'))) {
      const now = new Date().toISOString();
      await env.DB.prepare(`DELETE FROM event_rates WHERE label LIKE 'Musilac 2027%'`).run();
      const rows = [
        ['Marchés de Noël', '2026-12-11', '2026-12-13', 7200, 0], ['Marchés de Noël', '2026-12-18', '2026-12-20', 7200, 0],
        ["Fêtes de fin d'année", '2026-12-21', '2026-12-31', 7600, 0], ['Nouvel An', '2026-12-31', '2027-01-01', 10100, 2],
        ["Jour de l'an", '2027-01-01', '2027-01-02', 8000, 0], ['Saint-Valentin', '2027-02-12', '2027-02-14', 7600, 0],
        ['Pâques', '2027-03-26', '2027-03-29', 6800, 0],
        ['Musilac 2027 · veille', '2027-07-07', '2027-07-08', 8500, 2], ['Musilac 2027', '2027-07-08', '2027-07-12', 12700, 2],
      ];
      for (const r of rows) {
        await env.DB.prepare(`INSERT INTO event_rates (label, date_from, date_to, nightly_cents, min_nights, created_at) VALUES (?1,?2,?3,?4,?5,?6)`)
          .bind(r[0], r[1], r[2], r[3], r[4], now).run();
      }
      await env.CACHE.put('seed:events-v2', '1');
      await env.CACHE.put('seed:musilac27', '1');
    }
    const { results } = await env.DB.prepare(`SELECT * FROM event_rates ORDER BY date_from`).all();
    return results || [];
  } catch (e) { return []; }
}
function eventRateFor(rates, day) { return (rates || []).find((r) => day >= r.date_from && day < r.date_to) || null; }

// Valide un code promo (async car lecture D1). Renvoie { ok, promo } ou { ok:false, message }.
// ctx = { nights, checkin, checkout }.
export async function validatePromo(env, rawCode, ctx) {
  const code = (rawCode || '').toString().trim().toUpperCase();
  if (!code) return { ok: true, promo: null };
  let row;
  try {
    row = await env.DB.prepare(`SELECT * FROM promo_codes WHERE code = ?1`).bind(code).first();
  } catch (e) { return { ok: false, message: 'Code promo indisponible.' }; }
  if (!row || !row.active) return { ok: false, message: 'Code promo inconnu.' };
  if (row.max_uses > 0 && row.used_count >= row.max_uses) return { ok: false, message: 'Code promo épuisé.' };
  if (ctx && ctx.nights != null && row.min_nights > 0 && ctx.nights < row.min_nights) {
    return { ok: false, message: `Code valable à partir de ${row.min_nights} nuits.` };
  }
  if (ctx && isValidDate(ctx.checkin) && isValidDate(ctx.checkout) && (row.valid_from || row.valid_to)
      && promoNights(row, ctx.checkin, ctx.checkout) === 0) {
    const per = row.valid_from && row.valid_to ? `du ${dmy(row.valid_from)} au ${dmy(row.valid_to)}`
      : row.valid_from ? `à partir du ${dmy(row.valid_from)}` : `jusqu'au ${dmy(row.valid_to)}`;
    return { ok: false, message: `Ce code est valable pour les nuits ${per}.` };
  }
  return { ok: true, promo: row };
}

// Calcule un devis détaillé. ctx = { settings, promo }.
export function computeQuote(input, ctx) {
  const s = ctx.settings;
  const promo = ctx.promo || null;

  const checkin = input && input.checkin;
  const checkout = input && input.checkout;
  const guests = Math.max(1, parseInt(input && input.guests, 10) || 1);

  if (!isValidDate(checkin) || !isValidDate(checkout)) return { ok: false, error: 'dates', message: 'Dates invalides.' };
  const today = new Date().toISOString().slice(0, 10);
  if (checkin < today) return { ok: false, error: 'past', message: "La date d'arrivée est déjà passée." };
  const nights = nightsBetween(checkin, checkout);
  if (nights <= 0) return { ok: false, error: 'order', message: "Le départ doit être après l'arrivée." };
  if (guests > s.max_guests) return { ok: false, error: 'guests', message: `Maximum ${s.max_guests} voyageurs.` };
  if (nights < s.min_nights) return { ok: false, error: 'min', message: `Séjour minimum de ${s.min_nights} nuits.` };

  // Tarif par durée (paliers dégressifs). Le total est arrondi une seule fois à partir du
  // taux/nuit (fractionnaire pour semaine/cure) → totaux ronds exacts aux seuils.
  const rate = tierRate(nights, s);
  // Forfaits semaine / cure (ménage inclus) inchangés. Sinon : chaque nuit = Airbnb −15,5 %
  // + 50 € de ménage. Les tarifs événements (ex. Musilac) priment dans tous les cas.
  const tierMode = !!tierLabel(nights, s);
  const rates = ctx.eventRates || [];
  const special = new Map();
  const byPrice = new Map();
  let minEvent = 0, minLabel = '', tierNights = 0;
  for (let i = 0; i < nights; i++) {
    const day = new Date(Date.parse(checkin) + i * 86400000).toISOString().slice(0, 10);
    const r = eventRateFor(rates, day);
    if (!r) {
      if (tierMode) tierNights++;
      else { const p = siteNightCents(day, s); byPrice.set(p, (byPrice.get(p) || 0) + 1); }
      continue;
    }
    const k = r.label + '|' + r.nightly_cents;
    special.set(k, { label: r.label, cents: r.nightly_cents, n: ((special.get(k) || {}).n || 0) + 1 });
    if ((r.min_nights || 0) > minEvent) { minEvent = r.min_nights; minLabel = r.label; }
  }
  if (minEvent && nights < minEvent) return { ok: false, error: 'min', message: `Séjour minimum de ${minEvent} nuits pendant ${minLabel.split(' ·')[0]}.` };
  const specialNights = [...special.values()].reduce((a, x) => a + x.n, 0);
  const tierCents = Math.round(tierNights * rate);
  const mirrorCents = [...byPrice.entries()].reduce((a, [p, n]) => a + p * n, 0);
  const lodging = tierCents + mirrorCents + [...special.values()].reduce((a, x) => a + x.n * x.cents, 0);
  const nightlyEq = lodging / nights; // taux/nuit effectif (pour la taxe de séjour)

  const lines = [];
  const tag = tierLabel(nights, s);
  if (tierNights > 0) {
    lines.push({
      label: !specialNights ? `${nights} nuits · ${tag}` : `${tag} · ${tierNights} nuit${tierNights > 1 ? 's' : ''}`,
      cents: tierCents,
    });
  }
  for (const [p, n] of [...byPrice.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push({ label: `${Math.round(p / 100)} € × ${n} nuit${n > 1 ? 's' : ''}`, cents: p * n });
  }
  for (const x of special.values()) lines.push({ label: `${x.label} · ${Math.round(x.cents / 100)} € × ${x.n} nuit${x.n > 1 ? 's' : ''}`, cents: x.n * x.cents });
  const cleaningCents = tierMode ? 0 : CLEANING_CENTS;   // 50 € par séjour, comme sur Airbnb

  // Réduction dernière minute (optionnelle, sur l'hébergement).
  let lastminPct = 0;
  if (s.lastmin_days > 0 && s.lastmin_pct > 0) {
    const daysToArrival = nightsBetween(today, checkin);
    if (daysToArrival <= s.lastmin_days) lastminPct = s.lastmin_pct;
  }
  let lastminCents = Math.round(lodging * lastminPct / 100);
  if (lastminCents > 0) lines.push({ label: `Dernière minute (−${lastminPct}%)`, cents: -lastminCents });

  // Réservation anticipée (comme Airbnb) : −10 % sur les nuits si l'arrivée est à 3 mois ou plus.
  // Ne s'applique pas aux forfaits semaine / cure.
  let earlyCents = 0;
  if (!tierMode) {
    const lim = new Date(); lim.setUTCMonth(lim.getUTCMonth() + EARLY_MONTHS);
    if (checkin >= lim.toISOString().slice(0, 10)) {
      earlyCents = Math.round((lodging - tierCents) * EARLY_PCT / 100);
      if (earlyCents > 0) lines.push({ label: `Réservation anticipée (−${EARLY_PCT}%)`, cents: -earlyCents });
    }
  }

  let lodgingNet = lodging - lastminCents - earlyCents;

  // Code promo.
  let promoCents = 0;
  let promoFixed = 0;
  // Seules les nuits comprises dans la période du code sont remisées (ex. code « du 12 au 14 »,
  // séjour du 11 au 14 → −% sur les nuits du 12 et du 13 uniquement).
  if (promo) {
    const covered = promoNights(promo, checkin, checkout);
    if (covered > 0 && promo.kind === 'percent') {
      promoCents = Math.round(lodgingNet * (covered / nights) * promo.value / 100);
      lodgingNet -= promoCents;
      const sur = covered < nights ? ` sur ${covered} nuit${covered > 1 ? 's' : ''}` : '';
      lines.push({ label: `Code ${promo.code} (−${promo.value}%${sur})`, cents: -promoCents });
    } else if (covered > 0) {
      promoFixed = Math.min(promo.value, lodgingNet); // ne descend pas sous 0 sur l'hébergement
      lodgingNet -= promoFixed;
      lines.push({ label: `Code ${promo.code}`, cents: -promoFixed });
    }
  }

  const discountCents = lastminCents + earlyCents + promoCents + promoFixed;
  if (cleaningCents > 0) lines.push({ label: 'Ménage (par séjour)', cents: cleaningCents });


  // Taxe de séjour : par personne et par nuit, sur la base hébergement effectivement payée.
  // Ratio de remise appliqué au tarif de chaque nuit (hors promo fixe).
  let taxe = 0;
  if (s.taxe_enabled) {
    const ratio = lodging > 0 ? (lodging - lastminCents - earlyCents - promoCents) / lodging : 1;
    const perPerson = (nightlyEq * ratio) / guests;                  // coût HT nuit / personne
    const communal = Math.min((s.taxe_rate_pct / 100) * perPerson, s.taxe_cap_cents);
    const withAdd = communal * (1 + s.taxe_additional_pct / 100);
    taxe = Math.round(withAdd * guests * nights);                    // × nb personnes × nb nuits
    if (taxe > 0) lines.push({ label: 'Taxe de séjour', cents: taxe });
  }

  // Chien (1 maximum) : forfait par séjour, hors remises et hors taxe de séjour.
  const dog = !!(input && (input.dog === true || input.dog === 1 || input.dog === '1' || input.dog === 'true'));
  const petCents = dog ? (s.pet_fee_cents ?? 2000) : 0;
  if (petCents > 0) lines.push({ label: 'Chien (forfait séjour)', cents: petCents });

  const total = Math.max(0, lodgingNet + cleaningCents + taxe + petCents);

  return {
    ok: true,
    checkin, checkout, nights, guests, dog, petCents,
    currency: s.currency,
    lodgingCents: lodging,
    discountCents,
    cleaningCents,
    taxeCents: taxe,
    cautionCents: s.caution_cents || 0,
    promoCode: promo ? promo.code : null,
    totalCents: total,
    lines,
  };
}
