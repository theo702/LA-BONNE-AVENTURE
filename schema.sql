-- La Bonne Aventure — schéma de la base D1 (Cloudflare)
-- Appliquer : wrangler d1 execute lba-bookings --file=./schema.sql

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
  currency            TEXT NOT NULL DEFAULT 'eur',
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled
  stripe_session_id   TEXT,
  hold_expires_at     TEXT,                      -- ISO 8601 : fin du blocage temporaire des dates
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates   ON bookings(checkin, checkout);
