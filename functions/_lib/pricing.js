// Tarification — calcul du prix côté serveur (jamais de confiance au client).

export function getPricing(env = {}) {
  const int = (key, def) => {
    const v = env[key];
    const x = v !== undefined ? parseInt(v, 10) : NaN;
    return Number.isFinite(x) ? x : def;
  };
  return {
    currency: env.CURRENCY || 'eur',
    nightlyCents: int('NIGHTLY_CENTS', 6000),
    cleaningCents: int('CLEANING_CENTS', 4500),
    minNights: int('MIN_NIGHTS', 2),
    maxGuests: int('MAX_GUESTS', 2),
    taxePerPersonPerNightCents: int('TAXE_CENTS', 0),
  };
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function nightsBetween(checkin, checkout) {
  return Math.round((Date.parse(checkout) - Date.parse(checkin)) / 86400000);
}

// Renvoie un devis détaillé, ou { ok:false, error, message } en cas d'invalidité.
export function computeQuote(input, p) {
  const checkin = input && input.checkin;
  const checkout = input && input.checkout;
  const guests = Math.max(1, parseInt(input && input.guests, 10) || 1);

  if (!isValidDate(checkin) || !isValidDate(checkout)) {
    return { ok: false, error: 'dates', message: 'Dates invalides.' };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (checkin < today) {
    return { ok: false, error: 'past', message: "La date d'arrivée est déjà passée." };
  }
  const nights = nightsBetween(checkin, checkout);
  if (nights <= 0) {
    return { ok: false, error: 'order', message: "Le départ doit être après l'arrivée." };
  }
  if (nights < p.minNights) {
    return { ok: false, error: 'min', message: `Séjour minimum de ${p.minNights} nuits.` };
  }
  if (guests > p.maxGuests) {
    return { ok: false, error: 'guests', message: `Maximum ${p.maxGuests} voyageurs.` };
  }

  const lodgingCents = nights * p.nightlyCents;
  const taxeCents = p.taxePerPersonPerNightCents * guests * nights;
  const totalCents = lodgingCents + p.cleaningCents + taxeCents;

  return {
    ok: true,
    checkin,
    checkout,
    nights,
    guests,
    currency: p.currency,
    nightlyCents: p.nightlyCents,
    cleaningCents: p.cleaningCents,
    lodgingCents,
    taxeCents,
    totalCents,
  };
}
