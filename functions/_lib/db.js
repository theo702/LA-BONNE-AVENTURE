// Accès à la base D1 (réservations).

// Deux plages [aFrom,aTo) et [bFrom,bTo) se chevauchent-elles ? (dates 'YYYY-MM-DD')
export function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

// Plages occupées : réservations (confirmées + holds valides) + blocages manuels.
export async function getBusyRanges(env) {
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT checkin, checkout FROM bookings
      WHERE status = 'confirmed'
         OR (status = 'pending' AND hold_expires_at > ?1)`
  ).bind(nowIso).all();
  const ranges = (results || []).map((r) => ({ from: r.checkin, to: r.checkout, source: 'direct' }));
  try {
    const blocks = await env.DB.prepare(`SELECT date_from, date_to FROM manual_blocks`).all();
    for (const b of blocks.results || []) ranges.push({ from: b.date_from, to: b.date_to, source: 'manual' });
  } catch (e) { /* table absente en dev */ }
  return ranges;
}

// ---------- Blocages manuels ----------
export async function listBlocks(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM manual_blocks ORDER BY date_from`).all();
  return results || [];
}
export async function createBlock(env, b) {
  await env.DB.prepare(
    `INSERT INTO manual_blocks (date_from, date_to, label, created_at) VALUES (?1,?2,?3,?4)`
  ).bind(b.date_from, b.date_to, b.label || null, new Date().toISOString()).run();
}
export async function deleteBlock(env, id) {
  await env.DB.prepare(`DELETE FROM manual_blocks WHERE id = ?1`).bind(id).run();
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
        amount_total_cents, taxe_cents, discount_cents, promo_code, currency,
        status, hold_expires_at, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'pending',?14,?15)`
  ).bind(
    id, b.checkin, b.checkout, b.nights, b.name, b.email, b.phone || '',
    b.guests, b.amountCents, b.taxeCents || 0, b.discountCents || 0, b.promoCode || null,
    b.currency, holdExpires, nowIso
  ).run();
  return { id, holdExpires };
}

// ---------- Admin : réservations / réglages / promos / saisons ----------

export async function listBookings(env, limit = 200) {
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout, nights, guest_name, email, phone, guests,
            amount_total_cents, taxe_cents, discount_cents, promo_code, currency,
            status, created_at
       FROM bookings ORDER BY created_at DESC LIMIT ?1`
  ).bind(limit).all();
  return results || [];
}

export async function getSettings(env) {
  return env.DB.prepare(`SELECT * FROM settings WHERE id = 1`).first();
}

export async function updateSettings(env, s) {
  await env.DB.prepare(
    `UPDATE settings SET
       nightly_cents=?1, cleaning_cents=?2, min_nights=?3, max_guests=?4,
       weekly_pct=?5, weekly_min_nights=?6, monthly_pct=?7, monthly_min_nights=?8,
       lastmin_days=?9, lastmin_pct=?10, taxe_enabled=?11, taxe_rate_pct=?12,
       taxe_cap_cents=?13, taxe_additional_pct=?14
     WHERE id = 1`
  ).bind(
    s.nightly_cents, s.cleaning_cents, s.min_nights, s.max_guests,
    s.weekly_pct, s.weekly_min_nights, s.monthly_pct, s.monthly_min_nights,
    s.lastmin_days, s.lastmin_pct, s.taxe_enabled, s.taxe_rate_pct,
    s.taxe_cap_cents, s.taxe_additional_pct
  ).run();
}

export async function listPromos(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM promo_codes ORDER BY created_at DESC`).all();
  return results || [];
}

export async function createPromo(env, p) {
  await env.DB.prepare(
    `INSERT INTO promo_codes (code, kind, value, min_nights, valid_from, valid_to, max_uses, used_count, active, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,0,1,?8)`
  ).bind(
    p.code.toUpperCase(), p.kind, p.value, p.min_nights || 0,
    p.valid_from || null, p.valid_to || null, p.max_uses || 0, new Date().toISOString()
  ).run();
}

export async function deletePromo(env, id) {
  await env.DB.prepare(`DELETE FROM promo_codes WHERE id = ?1`).bind(id).run();
}

export async function incrementPromoUse(env, code) {
  if (!code) return;
  await env.DB.prepare(`UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?1`)
    .bind(String(code).toUpperCase()).run();
}

export async function listSeasons(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM season_rates ORDER BY date_from`).all();
  return results || [];
}

export async function createSeason(env, s) {
  await env.DB.prepare(
    `INSERT INTO season_rates (label, date_from, date_to, nightly_cents, min_nights, created_at)
     VALUES (?1,?2,?3,?4,?5,?6)`
  ).bind(s.label, s.date_from, s.date_to, s.nightly_cents, s.min_nights || null, new Date().toISOString()).run();
}

export async function deleteSeason(env, id) {
  await env.DB.prepare(`DELETE FROM season_rates WHERE id = ?1`).bind(id).run();
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
