-- LocalFoto D1 Analytics & Feedback Schema (Zero PII, Zero Images, Coarse ZIP-level only)

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,       -- 'visit' | 'photo_generated' | 'store_search'
  profile_id TEXT,                -- 'us_passport' | 'uk_passport' | etc.
  zip_code TEXT,                  -- Coarse postal/ZIP code from Cloudflare edge or store search
  city TEXT,
  region TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_zip ON events(zip_code);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating TEXT NOT NULL,           -- 'great' | 'okay' | 'needs_work'
  comment TEXT,
  profile_id TEXT,
  zip_code TEXT,
  city TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
