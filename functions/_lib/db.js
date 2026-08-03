// Accès à la base D1 (réservations).

// Deux plages [aFrom,aTo) et [bFrom,bTo) se chevauchent-elles ? (dates 'YYYY-MM-DD')
export function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

// Plages occupées : réservations (confirmées + holds valides) + blocages manuels.
export async function getBusyRanges(env, opts = {}) {
  const nowIso = new Date().toISOString();
  const exceptId = opts.exceptId || null;
  let results;
  if (exceptId) {
    ({ results } = await env.DB.prepare(
      `SELECT checkin, checkout FROM bookings
        WHERE id != ?2
          AND (status = 'confirmed'
           OR (status = 'pending' AND hold_expires_at > ?1))`
    ).bind(nowIso, exceptId).all());
  } else {
    ({ results } = await env.DB.prepare(
      `SELECT checkin, checkout FROM bookings
        WHERE status = 'confirmed'
           OR (status = 'pending' AND hold_expires_at > ?1)`
    ).bind(nowIso).all());
  }
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
  // SELECT complet d'abord (colonnes caution incluses) ; repli si la base n'est pas migrée.
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, checkin, checkout, nights, guest_name, email, phone, guests,
              amount_total_cents, taxe_cents, discount_cents, promo_code, currency,
              status, created_at, stripe_customer_id, stripe_payment_method
         FROM bookings ORDER BY created_at DESC LIMIT ?1`
    ).bind(limit).all();
    return results || [];
  } catch (e) {
    const { results } = await env.DB.prepare(
      `SELECT id, checkin, checkout, nights, guest_name, email, phone, guests,
              amount_total_cents, taxe_cents, discount_cents, promo_code, currency,
              status, created_at
         FROM bookings ORDER BY created_at DESC LIMIT ?1`
    ).bind(limit).all();
    return results || [];
  }
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
  // Caution (colonne récente → UPDATE tolérant).
  try {
    await env.DB.prepare(`UPDATE settings SET caution_cents=?1 WHERE id=1`)
      .bind(Math.max(0, Math.round(s.caution_cents || 0))).run();
  } catch (e) { /* colonne absente : ignorer */ }
  // Tarifs par durée : la semaine et la cure sont stockées en TOTAL (prix pour la durée
  // de référence) → totaux ronds exacts. UPDATE tolérant (colonnes récentes).
  try {
    await env.DB.prepare(`UPDATE settings SET week_total_cents=?1, cure_total_cents=?2 WHERE id=1`)
      .bind(
        Math.max(0, Math.round(s.week_total_cents || 0)),
        Math.max(0, Math.round(s.cure_total_cents || 0))
      ).run();
  } catch (e) { /* colonnes absentes : ignorer */ }
  // Fidélité (colonnes récentes → UPDATE tolérant).
  try {
    await env.DB.prepare(
      `UPDATE settings SET loyalty_enabled=?1, loyalty_points_per_night=?2,
         loyalty_points_per_reward=?3, loyalty_reward_pct=?4 WHERE id=1`
    ).bind(
      s.loyalty_enabled ? 1 : 0,
      Math.max(1, Math.round(s.loyalty_points_per_night || 1)),
      Math.max(1, Math.round(s.loyalty_points_per_reward || 10)),
      Math.min(100, Math.max(0, s.loyalty_reward_pct || 0))
    ).run();
  } catch (e) { /* colonnes absentes : ignorer */ }
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

// Auto-réparation du schéma : complète les colonnes settings/bookings ajoutées au fil des
// phases si la base a été créée avec une version ancienne. Chaque instruction est idempotente
// / tolérante (try/catch) et ne coûte qu'un aller-retour.
export async function ensurePricingSchema(env) {
  const run = async (sql) => { try { await env.DB.prepare(sql).run(); } catch (e) { /* déjà présent : ignorer */ } };
  await run(`ALTER TABLE settings ADD COLUMN dynamic_pricing_enabled INTEGER NOT NULL DEFAULT 1`);
  await run(`ALTER TABLE settings ADD COLUMN cleaning_emails TEXT NOT NULL DEFAULT ''`);
  // Caution (Phase 5).
  await run(`ALTER TABLE settings ADD COLUMN caution_cents INTEGER NOT NULL DEFAULT 0`);
  // Tarifs par durée en TOTAL (Phase 6) : 300 € la semaine, 750 € la cure.
  await run(`ALTER TABLE settings ADD COLUMN week_total_cents INTEGER NOT NULL DEFAULT 30000`);
  await run(`ALTER TABLE settings ADD COLUMN cure_total_cents INTEGER NOT NULL DEFAULT 75000`);
  // Empreinte bancaire : carte enregistrée pour débiter la caution en cas de dégât.
  await run(`ALTER TABLE bookings ADD COLUMN stripe_customer_id TEXT`);
  await run(`ALTER TABLE bookings ADD COLUMN stripe_payment_method TEXT`);
  // Prestations ménage : montant payé au prestataire par séjour + suivi « payé ».
  await run(`ALTER TABLE settings ADD COLUMN cleaning_pay_cents INTEGER NOT NULL DEFAULT 0`);
  await run(`ALTER TABLE bookings ADD COLUMN cleaning_paid INTEGER NOT NULL DEFAULT 0`);
  await run(`ALTER TABLE bookings ADD COLUMN cleaning_pay_cents INTEGER`);
  // Sources iCal à importer (calendriers des autres plateformes), gérées depuis l'admin.
  await run(`CREATE TABLE IF NOT EXISTS ical_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL)`);
  // Espace voyageur : connexion par lien magique + programme fidélité.
  await run(`CREATE TABLE IF NOT EXISTS magic_links (
    token TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`);
  await run(`CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, tier INTEGER NOT NULL,
    promo_code TEXT NOT NULL, created_at TEXT NOT NULL)`);
  await run(`ALTER TABLE settings ADD COLUMN loyalty_enabled INTEGER NOT NULL DEFAULT 1`);
  await run(`ALTER TABLE settings ADD COLUMN loyalty_points_per_night INTEGER NOT NULL DEFAULT 1`);
  await run(`ALTER TABLE settings ADD COLUMN loyalty_points_per_reward INTEGER NOT NULL DEFAULT 10`);
  await run(`ALTER TABLE settings ADD COLUMN loyalty_reward_pct REAL NOT NULL DEFAULT 10`);
  // Rappels email pour les séjours « en attente » (paiement non finalisé).
  await run(`ALTER TABLE bookings ADD COLUMN reminder_sent_at TEXT`);
}

// ---------- Espace voyageur : liens de connexion (magic link) ----------
export async function createMagicLink(env, email, ttlMinutes = 15) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO magic_links (token, email, expires_at, used, created_at) VALUES (?1,?2,?3,0,?4)`
  ).bind(token, email.toLowerCase(), expiresAt, new Date().toISOString()).run();
  return token;
}
// Valide + consomme (usage unique) un token. Renvoie l'email ou null si invalide/expiré/déjà utilisé.
export async function consumeMagicLink(env, token) {
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT * FROM magic_links WHERE token = ?1`).bind(token).first();
  if (!row || row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await env.DB.prepare(`UPDATE magic_links SET used = 1 WHERE token = ?1`).bind(token).run();
  return row.email;
}

// ---------- Espace voyageur : réservations d'un email ----------
// Les pending trop proches de l'arrivée (la veille ou après) sont masqués :
// checkin <= demain → déjà expirés (ex. arrivée le 17 → disparaît dès le 16).
export async function listBookingsByEmail(env, email) {
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout, nights, guests, amount_total_cents, currency, status,
            hold_expires_at, created_at
       FROM bookings
      WHERE email = ?1
        AND status != 'cancelled'
        AND NOT (status = 'pending' AND checkin <= date('now', '+1 day'))
      ORDER BY checkin DESC`
  ).bind((email || '').toLowerCase()).all();
  return results || [];
}
// Nuits confirmées cumulées pour un email (base du calcul de points).
export async function confirmedNightsByEmail(env, email) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(nights),0) AS n FROM bookings WHERE email = ?1 AND status = 'confirmed'`
  ).bind((email || '').toLowerCase()).first();
  return (row && row.n) || 0;
}

// ---------- Fidélité : récompenses déjà attribuées ----------
export async function listLoyaltyRewards(env, email) {
  const { results } = await env.DB.prepare(
    `SELECT id, tier, promo_code, created_at FROM loyalty_rewards WHERE email = ?1 ORDER BY tier`
  ).bind((email || '').toLowerCase()).all();
  return results || [];
}
export async function createLoyaltyReward(env, email, tier, promoCode) {
  await env.DB.prepare(
    `INSERT INTO loyalty_rewards (email, tier, promo_code, created_at) VALUES (?1,?2,?3,?4)`
  ).bind((email || '').toLowerCase(), tier, promoCode, new Date().toISOString()).run();
}

// ---------- Sources iCal (calendriers entrants des autres plateformes) ----------
export async function listIcalSources(env) {
  try {
    const { results } = await env.DB.prepare(`SELECT id, label, url FROM ical_sources ORDER BY id`).all();
    return results || [];
  } catch (e) { return []; }
}
export async function createIcalSource(env, s) {
  await env.DB.prepare(`INSERT INTO ical_sources (label, url, created_at) VALUES (?1,?2,?3)`)
    .bind(s.label, s.url, new Date().toISOString()).run();
}
export async function deleteIcalSource(env, id) {
  await env.DB.prepare(`DELETE FROM ical_sources WHERE id = ?1`).bind(id).run();
}

// ---------- Prestations ménage (un séjour confirmé = un ménage à payer) ----------
export async function listPrestations(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout, nights, guest_name, cleaning_paid, cleaning_pay_cents
       FROM bookings WHERE status = 'confirmed' ORDER BY checkout DESC`
  ).all();
  return results || [];
}
export async function setCleaningPaid(env, id, paid) {
  await env.DB.prepare(`UPDATE bookings SET cleaning_paid = ?1 WHERE id = ?2`).bind(paid ? 1 : 0, id).run();
}
// cents = null → le séjour reprend le tarif par défaut ; sinon montant personnalisé.
export async function setCleaningPay(env, id, cents) {
  const v = (cents == null) ? null : Math.max(0, Math.round(cents));
  await env.DB.prepare(`UPDATE bookings SET cleaning_pay_cents = ?1 WHERE id = ?2`).bind(v, id).run();
}
export async function setCleaningPayRate(env, cents) {
  try {
    await env.DB.prepare(`UPDATE settings SET cleaning_pay_cents = ?1 WHERE id = 1`)
      .bind(Math.max(0, Math.round(cents || 0))).run();
  } catch (e) { /* colonne absente : ignorer */ }
}

// Applique UNE SEULE FOIS le nouveau modèle de prix par durée (120 €/nuit, 300 € la semaine
// dès 6 nuits, 750 € la cure dès 20 nuits, ménage inclus), mais uniquement si les réglages
// sont encore au tarif d'usine (60 €/nuit) → on n'écrase jamais des prix déjà personnalisés.
// Marqueur KV : après application, l'hôte reste libre de tout modifier depuis l'admin.
export async function seedTierPricingOnce(env) {
  try {
    if (!env.CACHE) return;
    if (await env.CACHE.get('seed:tier-prices-v6')) return;
    await ensurePricingSchema(env);
    const s = await getSettings(env);
    if (s && Number(s.nightly_cents) === 6000) {
      await env.DB.prepare(
        `UPDATE settings SET nightly_cents=12000, cleaning_cents=0, min_nights=1,
           weekly_min_nights=6, monthly_min_nights=20,
           week_total_cents=30000, cure_total_cents=75000 WHERE id=1`
      ).run();
    }
    await env.CACHE.put('seed:tier-prices-v6', '1');
  } catch (e) { /* non bloquant */ }
}

// ---------- Calendrier admin : blocage par date ----------
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

export async function renewPendingHold(env, id) {
  const holdExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE bookings SET hold_expires_at = ?1 WHERE id = ?2 AND status = 'pending'`
  ).bind(holdExpires, id).run();
  return holdExpires;
}

// Pending à rappeler : pas encore arrivés à J-1, créés depuis ≥ 1 jour,
// et jamais rappelés ou rappelés il y a ≥ 7 jours.
export async function listPendingForReminder(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, checkin, checkout, nights, guests, guest_name, email, phone,
            amount_total_cents, currency, created_at, reminder_sent_at
       FROM bookings
      WHERE status = 'pending'
        AND checkin > date('now', '+1 day')
        AND date(created_at) <= date('now', '-1 day')
        AND (reminder_sent_at IS NULL
             OR date(reminder_sent_at) <= date('now', '-7 days'))
      ORDER BY checkin ASC
      LIMIT 50`
  ).all();
  return results || [];
}

// Expire (annule) les pending dès J-1 de l'arrivée — plus de mail, plus d'affichage compte.
export async function expireStalePending(env) {
  const res = await env.DB.prepare(
    `UPDATE bookings
        SET status = 'cancelled', hold_expires_at = NULL
      WHERE status = 'pending'
        AND checkin <= date('now', '+1 day')`
  ).run();
  return (res && res.meta && res.meta.changes) || 0;
}

export async function markReminderSent(env, id) {
  await env.DB.prepare(
    `UPDATE bookings SET reminder_sent_at = ?1 WHERE id = ?2`
  ).bind(new Date().toISOString(), id).run();
}

// Enregistre le client Stripe + le moyen de paiement (empreinte bancaire) sur la résa,
// pour pouvoir débiter la caution off-session en cas de dégât. Tolérant si les colonnes
// n'existent pas encore (base ancienne non migrée).
export async function attachStripeCustomer(env, id, customerId, paymentMethod) {
  if (!customerId && !paymentMethod) return;
  try {
    await env.DB.prepare(`UPDATE bookings SET stripe_customer_id = ?1, stripe_payment_method = ?2 WHERE id = ?3`)
      .bind(customerId || null, paymentMethod || null, id).run();
  } catch (e) { /* colonnes absentes : ignorer */ }
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
