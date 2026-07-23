// Tarification v2 — calcul du prix côté serveur (jamais de confiance au client).
// Réglages en base D1 (table settings) + tarifs saisonniers + réductions + taxe de séjour.

// Valeurs par défaut (fallback si la table settings n'est pas encore renseignée).
export function defaults(env = {}) {
  const int = (k, d) => { const x = parseInt(env[k], 10); return Number.isFinite(x) ? x : d; };
  return {
    currency: env.CURRENCY || 'eur',
    nightly_cents: int('NIGHTLY_CENTS', 6000),
    cleaning_cents: int('CLEANING_CENTS', 4500),
    min_nights: int('MIN_NIGHTS', 2),
    max_guests: int('MAX_GUESTS', 2),
    weekly_pct: 0, weekly_min_nights: 7,
    monthly_pct: 0, monthly_min_nights: 28,
    lastmin_days: 0, lastmin_pct: 0,
    taxe_enabled: 1, taxe_rate_pct: 5.0, taxe_cap_cents: 427, taxe_additional_pct: 10.0,
    cleaning_emails: '',
    dynamic_pricing_enabled: 1,
  };
}

// Charge les réglages depuis D1, complétés par les valeurs par défaut.
export async function loadSettings(env) {
  const d = defaults(env);
  try {
    const row = await env.DB.prepare(`SELECT * FROM settings WHERE id = 1`).first();
    if (row) return Object.assign(d, row);
  } catch (e) { /* table absente en dev : on garde les défauts */ }
  return d;
}

export async function loadSeasons(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT label, date_from, date_to, nightly_cents, min_nights FROM season_rates`
    ).all();
    return results || [];
  } catch (e) { return []; }
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
export function nightsBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function addDays(s, n) { var d = new Date(Date.parse(s)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Nombre de jours couverts par une période (sert à privilégier le tarif le plus spécifique).
function seasonSpan(s) { return Math.max(0, nightsBetween(s.date_from, s.date_to)); }

// Tarif d'une nuit donnée : tarif saisonnier/par date si la date tombe dans une période,
// sinon base. Si plusieurs périodes couvrent la date, la plus spécifique (span le plus
// court, ex. un override d'une seule journée) l'emporte. Désactivable via le réglage.
function nightlyForDate(dateStr, settings, seasons) {
  if (settings.dynamic_pricing_enabled) {
    let best = null;
    for (const s of seasons || []) {
      if (dateStr >= s.date_from && dateStr <= s.date_to) {
        if (!best || seasonSpan(s) < seasonSpan(best)) best = s;
      }
    }
    if (best) return { cents: best.nightly_cents, minNights: best.min_nights || null };
  }
  return { cents: settings.nightly_cents, minNights: null };
}

// Valide un code promo (async car lecture D1). Renvoie { ok, promo } ou { ok:false, message }.
export async function validatePromo(env, rawCode, ctx) {
  const code = (rawCode || '').toString().trim().toUpperCase();
  if (!code) return { ok: true, promo: null };
  let row;
  try {
    row = await env.DB.prepare(`SELECT * FROM promo_codes WHERE code = ?1`).bind(code).first();
  } catch (e) { return { ok: false, message: 'Code promo indisponible.' }; }
  if (!row || !row.active) return { ok: false, message: 'Code promo inconnu.' };
  const today = new Date().toISOString().slice(0, 10);
  if (row.valid_from && today < row.valid_from) return { ok: false, message: 'Code promo pas encore actif.' };
  if (row.valid_to && today > row.valid_to) return { ok: false, message: 'Code promo expiré.' };
  if (row.max_uses > 0 && row.used_count >= row.max_uses) return { ok: false, message: 'Code promo épuisé.' };
  if (ctx && ctx.nights != null && row.min_nights > 0 && ctx.nights < row.min_nights) {
    return { ok: false, message: `Code valable à partir de ${row.min_nights} nuits.` };
  }
  return { ok: true, promo: row };
}

// Calcule un devis détaillé. ctx = { settings, seasons, promo }.
export function computeQuote(input, ctx) {
  const s = ctx.settings;
  const seasons = ctx.seasons || [];
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

  // Somme des nuits (tarif saisonnier par nuit) + minimum de nuits effectif.
  let lodging = 0;
  let effMinNights = s.min_nights;
  const perNight = [];
  for (let i = 0; i < nights; i++) {
    const d = addDays(checkin, i);
    const r = nightlyForDate(d, s, seasons);
    perNight.push(r.cents);
    lodging += r.cents;
    if (r.minNights && r.minNights > effMinNights) effMinNights = r.minNights;
  }
  if (nights < effMinNights) return { ok: false, error: 'min', message: `Séjour minimum de ${effMinNights} nuits.` };

  const lines = [];
  const avg = Math.round(lodging / nights);
  lines.push({ label: `${(avg / 100).toFixed(0)} € × ${nights} nuits`, cents: lodging });

  // Réduction durée (mensuelle prioritaire sur hebdo).
  let durationPct = 0;
  if (s.monthly_pct > 0 && nights >= s.monthly_min_nights) durationPct = s.monthly_pct;
  else if (s.weekly_pct > 0 && nights >= s.weekly_min_nights) durationPct = s.weekly_pct;
  let durationCents = Math.round(lodging * durationPct / 100);
  if (durationCents > 0) lines.push({ label: `Réduction séjour (−${durationPct}%)`, cents: -durationCents });

  // Réduction dernière minute.
  let lastminPct = 0;
  if (s.lastmin_days > 0 && s.lastmin_pct > 0) {
    const daysToArrival = nightsBetween(today, checkin);
    if (daysToArrival <= s.lastmin_days) lastminPct = s.lastmin_pct;
  }
  const afterDuration = lodging - durationCents;
  let lastminCents = Math.round(afterDuration * lastminPct / 100);
  if (lastminCents > 0) lines.push({ label: `Dernière minute (−${lastminPct}%)`, cents: -lastminCents });

  let lodgingNet = afterDuration - lastminCents;

  // Code promo.
  let promoCents = 0;
  let promoFixed = 0;
  if (promo) {
    if (promo.kind === 'percent') {
      promoCents = Math.round(lodgingNet * promo.value / 100);
      lodgingNet -= promoCents;
      lines.push({ label: `Code ${promo.code} (−${promo.value}%)`, cents: -promoCents });
    } else {
      promoFixed = Math.min(promo.value, lodgingNet); // ne descend pas sous 0 sur l'hébergement
      lodgingNet -= promoFixed;
      lines.push({ label: `Code ${promo.code}`, cents: -promoFixed });
    }
  }

  const discountCents = durationCents + lastminCents + promoCents + promoFixed;

  // Frais de ménage.
  const cleaning = s.cleaning_cents;
  lines.push({ label: 'Frais de ménage', cents: cleaning });

  // Taxe de séjour : par personne et par nuit, sur la base hébergement effectivement payée.
  // Ratio de remise appliqué au tarif de chaque nuit (hors ménage, hors promo fixe).
  let taxe = 0;
  if (s.taxe_enabled) {
    const ratio = lodging > 0 ? (lodging - durationCents - lastminCents - promoCents) / lodging : 1;
    for (const nightlyCents of perNight) {
      const perPerson = (nightlyCents * ratio) / guests;              // coût HT nuit / personne
      const communal = Math.min((s.taxe_rate_pct / 100) * perPerson, s.taxe_cap_cents);
      const withAdd = communal * (1 + s.taxe_additional_pct / 100);
      taxe += withAdd * guests;
    }
    taxe = Math.round(taxe);
    if (taxe > 0) lines.push({ label: 'Taxe de séjour', cents: taxe });
  }

  const total = Math.max(0, lodgingNet + cleaning + taxe);

  return {
    ok: true,
    checkin, checkout, nights, guests,
    currency: s.currency,
    lodgingCents: lodging,
    discountCents,
    cleaningCents: cleaning,
    taxeCents: taxe,
    promoCode: promo ? promo.code : null,
    totalCents: total,
    lines,
  };
}
