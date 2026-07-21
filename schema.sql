-- La Bonne Aventure — schéma de la base D1 (Cloudflare)
-- Appliquer : wrangler d1 execute lba-bookings --remote --file=./schema.sql

-- ---------- Réservations ----------
CREATE TABLE IF NOT EXISTS bookings (
  id                  TEXT PRIMARY KEY,          -- UUID
  checkin             TEXT NOT NULL,             -- 'YYYY-MM-DD' (nuit d'arrivée incluse)
  checkout            TEXT NOT NULL,             -- 'YYYY-MM-DD' (jour de départ, exclu)
  nights              INTEGER NOT NULL,
  guest_name          TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  guests              INTEGER NOT NULL DEFAULT 1,
  amount_total_cents  INTEGER NOT NULL,
  taxe_cents          INTEGER NOT NULL DEFAULT 0,
  discount_cents      INTEGER NOT NULL DEFAULT 0,
  promo_code          TEXT,
  currency            TEXT NOT NULL DEFAULT 'eur',
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled
  stripe_session_id   TEXT,
  hold_expires_at     TEXT,                      -- ISO 8601 : fin du blocage temporaire
  created_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates   ON bookings(checkin, checkout);

-- ---------- Paramètres (tarifs, réductions, taxe) — ligne unique id=1 ----------
CREATE TABLE IF NOT EXISTS settings (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  nightly_cents       INTEGER NOT NULL DEFAULT 6000,
  cleaning_cents      INTEGER NOT NULL DEFAULT 4500,
  min_nights          INTEGER NOT NULL DEFAULT 2,
  max_guests          INTEGER NOT NULL DEFAULT 2,
  weekly_pct          REAL    NOT NULL DEFAULT 0,   -- réduction séjour ≥ weekly_min_nights
  weekly_min_nights   INTEGER NOT NULL DEFAULT 7,
  monthly_pct         REAL    NOT NULL DEFAULT 0,   -- réduction séjour ≥ monthly_min_nights
  monthly_min_nights  INTEGER NOT NULL DEFAULT 28,
  lastmin_days        INTEGER NOT NULL DEFAULT 0,   -- 0 = désactivé
  lastmin_pct         REAL    NOT NULL DEFAULT 0,
  taxe_enabled        INTEGER NOT NULL DEFAULT 1,
  taxe_rate_pct       REAL    NOT NULL DEFAULT 5.0, -- % du coût HT de la nuitée / personne
  taxe_cap_cents      INTEGER NOT NULL DEFAULT 427, -- plafond 4,27 € / personne / nuit
  taxe_additional_pct REAL    NOT NULL DEFAULT 10.0,-- taxes additionnelles (départementale…)
  currency            TEXT    NOT NULL DEFAULT 'eur'
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

-- ---------- Codes promo ----------
CREATE TABLE IF NOT EXISTS promo_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,            -- stocké en MAJUSCULES
  kind        TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  value       INTEGER NOT NULL,               -- % (0-100) ou centimes
  min_nights  INTEGER NOT NULL DEFAULT 0,
  valid_from  TEXT,                           -- 'YYYY-MM-DD' (nullable)
  valid_to    TEXT,
  max_uses    INTEGER NOT NULL DEFAULT 0,      -- 0 = illimité
  used_count  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- ---------- Tarifs saisonniers ----------
CREATE TABLE IF NOT EXISTS season_rates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  label         TEXT NOT NULL,
  date_from     TEXT NOT NULL,                 -- 'YYYY-MM-DD' (inclus)
  date_to       TEXT NOT NULL,                 -- 'YYYY-MM-DD' (inclus)
  nightly_cents INTEGER NOT NULL,
  min_nights    INTEGER,                       -- nullable : override du minimum de nuits
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasons_range ON season_rates(date_from, date_to);
