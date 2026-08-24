// Pack curiste : 1 ménage+linge par semaine = 1 samedi dans le séjour.
// On compte les samedis dans [arrivée, départ) (départ exclus), plafonné à 4.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(s) {
  if (!YMD.test(s || '')) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Nombre de samedis (UTC) dans [arrival, departure). */
export function countWeeklyServices(arrival, departure) {
  const start = parseYmd(arrival);
  const end = parseYmd(departure);
  if (!start || !end) {
    return { weeks: 0, ok: false, message: 'Indiquez vos dates d’arrivée et de départ.' };
  }
  if (end <= start) {
    return { weeks: 0, ok: false, message: 'La date de départ doit être après l’arrivée.' };
  }
  let count = 0;
  const cur = new Date(start.getTime());
  while (cur < end) {
    if (cur.getUTCDay() === 6) count += 1; // samedi
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (count < 1) {
    return {
      weeks: 0,
      ok: false,
      message: 'Aucun week-end dans ce séjour — le pack se facture par samedi (ménage + linge).',
    };
  }
  if (count > 4) {
    return {
      weeks: 4,
      ok: true,
      capped: true,
      message: `Maximum 4 semaines en ligne (${formatYmd(start)} → ${formatYmd(end)}). Contactez-nous pour un séjour plus long.`,
    };
  }
  return { weeks: count, ok: true, capped: false };
}

export function weeklyPackQuote(arrival, departure, unitCents) {
  const r = countWeeklyServices(arrival, departure);
  const unit = Math.max(0, Math.round(Number(unitCents) || 0));
  if (!r.ok) return { ...r, unit_cents: unit, amount_cents: 0 };
  return {
    ...r,
    unit_cents: unit,
    amount_cents: unit * r.weeks,
  };
}
