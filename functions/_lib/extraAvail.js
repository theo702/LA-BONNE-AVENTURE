// Disponibilité d'un extra sensible à la rotation (départ tardif vs arrivée anticipée).
// Règle : sur une même date, on ne peut pas avoir à la fois un départ tardif ET une arrivée
// anticipée (les deux voyageurs se croiseraient, pas le temps de faire le ménage).
// On se base sur les extras DÉJÀ PAYÉS (mémoire), pas sur le calendrier des réservations.
const OPPOSITE = { late_checkout: 'early_checkin', early_checkin: 'late_checkout' };

// Vérifie qu'un kind simple (late_checkout ou early_checkin) est disponible à une date.
export async function extraAvailable(env, kind, date) {
  if (!OPPOSITE[kind]) return { available: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { available: false, needsDate: true, message: 'Indiquez la date concernée.' };

  // Bloque immédiatement : extra opposé déjà PAYÉ (confirmed) OU en cours de paiement
  // (pending récent < 2 h — au-delà, une tentative abandonnée est ignorée).
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  let row = null;
  try {
    row = await env.DB.prepare(
      `SELECT 1 FROM extra_orders
        WHERE service_date = ?1 AND kind = ?2
          AND (status = 'confirmed' OR (status = 'pending' AND created_at > ?3))
        LIMIT 1`
    ).bind(date, OPPOSITE[kind], cutoff).first();
  } catch (e) { row = null; }

  if (row) {
    return {
      available: false,
      message: kind === 'late_checkout'
        ? "Indisponible : une arrivée anticipée est déjà réservée ce jour-là."
        : "Indisponible : un départ tardif est déjà réservé ce jour-là.",
    };
  }
  return { available: true };
}

// Vérifie qu'un extra "both" (départ tardif + arrivée anticipée) est disponible :
// - lateDate : pas d'arrivée anticipée déjà réservée ce jour-là
// - earlyDate : pas de départ tardif déjà réservé ce jour-là
export async function extraAvailableBoth(env, lateDate, earlyDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lateDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(earlyDate || '')) {
    return { available: false, needsDate: true, message: 'Indiquez les deux dates.' };
  }
  const avLate = await extraAvailable(env, 'late_checkout', lateDate);
  if (!avLate.available) return avLate;
  const avEarly = await extraAvailable(env, 'early_checkin', earlyDate);
  if (!avEarly.available) return avEarly;
  return { available: true };
}
