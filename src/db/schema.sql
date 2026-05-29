-- ============================================================
-- BarberBot · esquema SQLite
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  duration_min    INTEGER NOT NULL,
  price_eur       REAL NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS clients (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_id           TEXT UNIQUE NOT NULL,           -- número WhatsApp (e164 sin +)
  name            TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL,
  service_id      INTEGER NOT NULL,
  starts_at       DATETIME NOT NULL,              -- ISO 8601 UTC
  ends_at         DATETIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled | done
  reminder_sent   INTEGER NOT NULL DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_starts_at ON appointments(starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
