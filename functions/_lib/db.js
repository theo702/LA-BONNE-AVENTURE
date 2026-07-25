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

// ---------- Extras (catalogue) ----------
export async function listExtras(env, activeOnly = false) {
  const sql = `SELECT * FROM extras ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY position, id`;
  const { results } = await env.DB.prepare(sql).all();
  return results || [];
}
export async function getExtra(env, id) {
  return env.DB.prepare(`SELECT * FROM extras WHERE id = ?1`).bind(id).first();
}
export async function createExtra(env, e) {
  await env.DB.prepare(
    `INSERT INTO extras (title, description, condition, price_cents, kind, active, position, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
  ).bind(e.title, e.description || '', e.condition || '', e.price_cents, e.kind || 'none', e.active ? 1 : 0, e.position || 0, new Date().toISOString()).run();
}
export async function updateExtra(env, id, e) {
  await env.DB.prepare(
    `UPDATE extras SET title=?1, description=?2, condition=?3, price_cents=?4, kind=?5, active=?6, position=?7 WHERE id=?8`
  ).bind(e.title, e.description || '', e.condition || '', e.price_cents, e.kind || 'none', e.active ? 1 : 0, e.position || 0, id).run();
}
export async function deleteExtra(env, id) {
  await env.DB.prepare(`DELETE FROM extras WHERE id = ?1`).bind(id).run();
}

// ---------- Commandes d'extras ----------
export async function createExtraOrder(env, o) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO extra_orders (id, extra_id, title, amount_cents, currency, guest_name, email, kind, service_date, status, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'pending',?10)`
  ).bind(id, o.extra_id, o.title, o.amount_cents, o.currency, o.guest_name || '', o.email || '', o.kind || 'none', o.service_date || null, new Date().toISOString()).run();
  return { id };
}
export async function attachExtraSession(env, id, sessionId) {
  await env.DB.prepare(`UPDATE extra_orders SET stripe_session_id = ?1 WHERE id = ?2`).bind(sessionId, id).run();
}
export async function getExtraOrder(env, id) {
  return env.DB.prepare(`SELECT * FROM extra_orders WHERE id = ?1`).bind(id).first();
}
export async function confirmExtraOrder(env, id) {
  await env.DB.prepare(`UPDATE extra_orders SET status = 'confirmed' WHERE id = ?1`).bind(id).run();
}
export async function listExtraOrders(env, limit = 100) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM extra_orders ORDER BY created_at DESC LIMIT ?1`
  ).bind(limit).all();
  return results || [];
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
  // Colonnes historiques : toujours présentes → un seul UPDATE.
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
  // Colonnes ajoutées plus tard : tolérer une migration non encore appliquée
  // (sinon un simple enregistrement de réductions échouerait en entier).
  try {
    await env.DB.prepare(`UPDATE settings SET cleaning_emails=?1 WHERE id=1`).bind(s.cleaning_emails || '').run();
  } catch (e) { /* colonne absente : ignorer */ }
  try {
    await env.DB.prepare(`UPDATE settings SET dynamic_pricing_enabled=?1 WHERE id=1`).bind(s.dynamic_pricing_enabled ? 1 : 0).run();
  } catch (e) { /* colonne absente : ignorer */ }
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

// Insertion en masse via une SEULE opération D1 (batch) → indispensable pour charger une
// année de prix (des centaines de lignes) sans dépasser la limite de sous-requêtes du plan
// gratuit Cloudflare (50). Découpe en INSERT multi-lignes de CHUNK lignes (≤ limite SQLite
// de variables liées). `replace` vide d'abord la table, dans le même batch atomique.
export async function bulkReplaceSeasons(env, items, { replace = false } = {}) {
  const CHUNK = 16; // D1 limite à 100 variables liées/requête → 16 lignes × 6 colonnes = 96 (< 100)
  const now = new Date().toISOString();
  const stmts = [];
  if (replace) stmts.push(env.DB.prepare(`DELETE FROM season_rates`));
  for (let i = 0; i < items.length; i += CHUNK) {
    const part = items.slice(i, i + CHUNK);
    const values = part.map(() => '(?,?,?,?,?,?)').join(',');
    const binds = [];
    for (const s of part) {
      binds.push(s.label, s.date_from, s.date_to, s.nightly_cents, s.min_nights || null, now);
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO season_rates (label, date_from, date_to, nightly_cents, min_nights, created_at) VALUES ${values}`
      ).bind(...binds)
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return items.length;
}

export async function deleteAllSeasons(env) {
  await env.DB.prepare(`DELETE FROM season_rates`).run();
}

// ---------- Calendrier admin : prix par date + blocage par date ----------
const addDayStr = (s, n) => { const d = new Date(Date.parse(s)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Réservations (directes) à afficher sur le calendrier admin : confirmées + holds valides.
export async function listCalendarBookings(env) {
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout, guest_name, status FROM bookings
      WHERE status = 'confirmed' OR (status = 'pending' AND hold_expires_at > ?1)
      ORDER BY checkin`
  ).bind(nowIso).all();
  return results || [];
}

// Fixe un prix pour UNE date (override d'une seule journée). Remplace tout override
// journalier existant sur cette date ; les périodes multi-jours restent intactes.
export async function setDatePrice(env, date, cents, minNights) {
  await env.DB.prepare(`DELETE FROM season_rates WHERE date_from = ?1 AND date_to = ?1`).bind(date).run();
  await env.DB.prepare(
    `INSERT INTO season_rates (label, date_from, date_to, nightly_cents, min_nights, created_at)
     VALUES (?1,?2,?2,?3,?4,?5)`
  ).bind('Prix du jour', date, cents, minNights || null, new Date().toISOString()).run();
}

// Supprime l'override journalier d'une date (retour au tarif de période ou au tarif de base).
export async function clearDatePrice(env, date) {
  await env.DB.prepare(`DELETE FROM season_rates WHERE date_from = ?1 AND date_to = ?1`).bind(date).run();
}

// Bloque une seule date (nuit). date_to est exclusif → date + 1 jour.
export async function blockDate(env, date, label) {
  await env.DB.prepare(
    `INSERT INTO manual_blocks (date_from, date_to, label, created_at) VALUES (?1,?2,?3,?4)`
  ).bind(date, addDayStr(date, 1), label || null, new Date().toISOString()).run();
}

// Débloque une seule date : retire ce jour des blocages manuels, en scindant au besoin
// toute plage qui l'englobe (date_to exclusif).
export async function unblockDate(env, date) {
  const next = addDayStr(date, 1);
  const { results } = await env.DB.prepare(
    `SELECT id, date_from, date_to, label FROM manual_blocks WHERE date_from <= ?1 AND date_to > ?1`
  ).bind(date).all();
  for (const b of results || []) {
    await env.DB.prepare(`DELETE FROM manual_blocks WHERE id = ?1`).bind(b.id).run();
    if (b.date_from < date) await createBlock(env, { date_from: b.date_from, date_to: date, label: b.label });
    if (next < b.date_to) await createBlock(env, { date_from: next, date_to: b.date_to, label: b.label });
  }
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

export async function deleteBookingById(env, id) {
  await env.DB.prepare(`DELETE FROM bookings WHERE id = ?1`).bind(id).run();
}
