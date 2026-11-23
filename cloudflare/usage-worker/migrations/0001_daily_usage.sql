-- Aggregate daily counts only. Deliberately NO UUID, IP, visitor, file or music fields.
CREATE TABLE IF NOT EXISTS usage_counts (
  day_utc TEXT NOT NULL CHECK (day_utc GLOB '????-??-??'),
  event_name TEXT NOT NULL CHECK (event_name IN ('studio_ready','project_export')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day_utc, event_name)
);
