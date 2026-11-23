-- Raw IP addresses, music files and personally identifying fields are deliberately absent.
-- Keep original answers for quarterly NPS analysis; define retention/deletion rules before launch.
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  browser_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  explanation TEXT NOT NULL CHECK (length(trim(explanation)) BETWEEN 15 AND 2000),
  submitted_at TEXT NOT NULL,
  product_phase TEXT NOT NULL CHECK (product_phase IN ('LABS', 'BETA')),
  country_code TEXT,
  region TEXT,
  city TEXT
);
CREATE INDEX IF NOT EXISTS feedback_uuid_time
  ON feedback_submissions (browser_id, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS feedback_submitted_at
  ON feedback_submissions (submitted_at);
