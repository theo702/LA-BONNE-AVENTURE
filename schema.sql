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
  stripe_customer_id  TEXT,                      -- client Stripe (empreinte bancaire / caution)
  stripe_payment_method TEXT,                    -- moyen de paiement enregistré (débit caution off-session)
  cleaning_paid       INTEGER NOT NULL DEFAULT 0,-- ménage payé au prestataire (suivi prestations)
  cleaning_pay_cents  INTEGER,                   -- montant ménage pour CE séjour (NULL = tarif par défaut)
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
  weekly_pct          REAL    NOT NULL DEFAULT 0,   -- (déprécié)
  weekly_min_nights   INTEGER NOT NULL DEFAULT 6,   -- « semaine » dès 6 nuits (7 jours)
  monthly_pct         REAL    NOT NULL DEFAULT 0,   -- (déprécié)
  monthly_min_nights  INTEGER NOT NULL DEFAULT 20,  -- « cure » dès 20 nuits (21 jours)
  lastmin_days        INTEGER NOT NULL DEFAULT 0,   -- 0 = désactivé
  lastmin_pct         REAL    NOT NULL DEFAULT 0,
  taxe_enabled        INTEGER NOT NULL DEFAULT 1,
  taxe_rate_pct       REAL    NOT NULL DEFAULT 5.0, -- % du coût HT de la nuitée / personne
  taxe_cap_cents      INTEGER NOT NULL DEFAULT 427, -- plafond 4,27 € / personne / nuit
  taxe_additional_pct REAL    NOT NULL DEFAULT 10.0,-- taxes additionnelles (départementale…)
  cleaning_emails     TEXT    NOT NULL DEFAULT '',  -- emails équipe ménage (séparés par virgule)
  dynamic_pricing_enabled INTEGER NOT NULL DEFAULT 1, -- (déprécié, conservé pour compat)
  week_total_cents    INTEGER NOT NULL DEFAULT 30000, -- prix TOTAL d'une semaine (≥ weekly_min_nights) = 300 €
  cure_total_cents    INTEGER NOT NULL DEFAULT 75000, -- prix TOTAL d'une cure (≥ monthly_min_nights) = 750 €
  caution_cents       INTEGER NOT NULL DEFAULT 0,     -- caution (empreinte bancaire), 0 = désactivée
  cleaning_pay_cents  INTEGER NOT NULL DEFAULT 0,     -- montant payé au prestataire par ménage (défaut)
  currency            TEXT    NOT NULL DEFAULT 'eur'
);
INSERT OR IGNORE INTO settings (id) VALUES (1);
-- Sur une base déjà créée, ajouter les colonnes une seule fois :
-- ALTER TABLE settings ADD COLUMN cleaning_emails TEXT NOT NULL DEFAULT '';
-- ALTER TABLE settings ADD COLUMN dynamic_pricing_enabled INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE settings ADD COLUMN caution_cents INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE settings ADD COLUMN week_total_cents INTEGER NOT NULL DEFAULT 30000;
-- ALTER TABLE settings ADD COLUMN cure_total_cents INTEGER NOT NULL DEFAULT 75000;
-- ALTER TABLE bookings ADD COLUMN stripe_customer_id TEXT;
-- ALTER TABLE bookings ADD COLUMN stripe_payment_method TEXT;

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

-- ---------- Tarifs saisonniers (DÉPRÉCIÉ — plus utilisé depuis les tarifs par durée) ----------
-- Table conservée pour ne pas casser les bases existantes ; elle n'est plus lue ni écrite.
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

-- ---------- Sources iCal entrantes (calendriers des autres plateformes) ----------
CREATE TABLE IF NOT EXISTS ical_sources (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,                    -- nom (sert à ?exclude=label à l'export)
  url        TEXT NOT NULL,                    -- URL d'export iCal de la plateforme
  created_at TEXT NOT NULL
);

-- ---------- Blocages manuels (dates rendues indisponibles par l'hôte) ----------
CREATE TABLE IF NOT EXISTS manual_blocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date_from  TEXT NOT NULL,                   -- 'YYYY-MM-DD' (nuit incluse)
  date_to    TEXT NOT NULL,                   -- 'YYYY-MM-DD' (jour de fin, exclu)
  label      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blocks_range ON manual_blocks(date_from, date_to);

-- ---------- Extras (options payantes, gérées depuis l'admin) ----------
CREATE TABLE IF NOT EXISTS extras (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT,
  condition   TEXT,
  price_cents INTEGER NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'none',   -- none | late_checkout | early_checkin
  active      INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
INSERT OR IGNORE INTO extras (id,title,description,condition,price_cents,kind,position,created_at) VALUES
 (1,'Départ tardif','Profitez de votre hébergement 2 heures de plus le jour du départ — départ jusqu''à 13h00.','Sous réserve de disponibilité',1500,'late_checkout',1,'seed'),
 (2,'Arrivée anticipée','Accédez au logement 2 heures avant l''horaire habituel.','Sous réserve de disponibilité',1500,'early_checkin',2,'seed');

-- ---------- Commandes d'extras ----------
CREATE TABLE IF NOT EXISTS extra_orders (
  id                TEXT PRIMARY KEY,          -- UUID
  extra_id          INTEGER,
  title             TEXT,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'eur',
  guest_name        TEXT,
  email             TEXT,
  kind              TEXT,                      -- none | late_checkout | early_checkin
  service_date      TEXT,                      -- date concernée (départ/arrivée) si applicable
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed
  stripe_session_id TEXT,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_extra_orders_status ON extra_orders(status);
