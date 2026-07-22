// Disponibilité d'un extra sensible à la rotation (départ tardif vs arrivée anticipée).
// Règle : sur une même date, on ne peut pas avoir à la fois un départ tardif ET une arrivée
// anticipée (les deux voyageurs se croiseraient, pas le temps de faire le ménage).
// On se base sur les extras DÉJÀ PAYÉS (mémoire), pas sur le calendrier des réservations.
const OPPOSITE = { late_checkout: 'early_checkin', early_checkin: 'late_checkout' };

export async function extraAvailable(env, kind, date) {
  if (!OPPOSITE[kind]) return { available: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { available: false, needsDate: true, message: 'Indiquez la date concernée.' };

  let row = null;
  try {
    row = await env.DB.prepare(
      `SELECT 1 FROM extra_orders WHERE service_date = ?1 AND kind = ?2 AND status = 'confirmed' LIMIT 1`
    ).bind(date, OPPOSITE[kind]).first();
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
