// Accès à la base D1 (réservations).

// Deux plages [aFrom,aTo) et [bFrom,bTo) se chevauchent-elles ? (dates 'YYYY-MM-DD')
export function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

// Plages occupées par nos réservations : confirmées + blocages temporaires encore valides.
export async function getBusyRanges(env) {
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT checkin, checkout FROM bookings
      WHERE status = 'confirmed'
         OR (status = 'pending' AND hold_expires_at > ?1)`
  ).bind(nowIso).all();
  return (results || []).map((r) => ({ from: r.checkin, to: r.checkout, source: 'direct' }));
}

// Réservations confirmées (pour l'export /calendar.ics).
export async function getConfirmed(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout FROM bookings WHERE status = 'confirmed' ORDER BY checkin`
  ).all();
  return results || [];
}

export async function createPendingBooking(env, b) {
  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const holdExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
  await env.DB.prepare(
    `INSERT INTO bookings
       (id, checkin, checkout, nights, guest_name, email, phone, guests,
        amount_total_cents, currency, status, hold_expires_at, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'pending',?11,?12)`
  ).bind(
    id, b.checkin, b.checkout, b.nights, b.name, b.email, b.phone || '',
    b.guests, b.amountCents, b.currency, holdExpires, nowIso
  ).run();
  return { id, holdExpires };
}

export async function attachSession(env, id, sessionId) {
  await env.DB.prepare(`UPDATE bookings SET stripe_session_id = ?1 WHERE id = ?2`)
    .bind(sessionId, id).run();
}

export async function getBooking(env, id) {
  return env.DB.prepare(`SELECT * FROM bookings WHERE id = ?1`).bind(id).first();
}

export async function confirmBooking(env, id) {
  await env.DB.prepare(`UPDATE bookings SET status = 'confirmed', hold_expires_at = NULL WHERE id = ?1`)
    .bind(id).run();
}

export async function cancelBooking(env, id) {
  await env.DB.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?1 AND status = 'pending'`)
    .bind(id).run();
}
