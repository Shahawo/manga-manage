-- ============================================================
-- Manga-Cloudflare D1 SQLite schema
-- Run this using `wrangler d1 execute`
-- ============================================================

-- 1. Users (Optional, mapping Access ID to user info)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Personal library (manga)
CREATE TABLE IF NOT EXISTS manga (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  series TEXT NOT NULL,
  title TEXT NOT NULL,
  volume REAL,
  isbn TEXT,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  distributor TEXT,
  publish_date TEXT, -- YYYY-MM-DD
  pages INTEGER,
  size TEXT,
  price INTEGER,
  note TEXT,
  cover_url TEXT,
  gift_urls TEXT DEFAULT '[]', -- JSON array
  catalog_id TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manga_user_id ON manga(user_id);
CREATE INDEX IF NOT EXISTS idx_manga_series ON manga(series);

-- 3. Shared catalog
CREATE TABLE IF NOT EXISTS catalog (
  id TEXT PRIMARY KEY,
  series TEXT,
  title TEXT NOT NULL,
  volume REAL,
  isbns TEXT DEFAULT '[]', -- JSON array
  author TEXT,
  translator TEXT,
  publisher TEXT,
  distributor TEXT,
  publish_date TEXT,
  pages INTEGER,
  size TEXT,
  price INTEGER,
  cover_url TEXT,
  note TEXT,
  gift_urls TEXT DEFAULT '[]', -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_series ON catalog(series);

-- 4. Pending catalog contributions
CREATE TABLE IF NOT EXISTS pending_catalog (
  id TEXT PRIMARY KEY,
  submitted_by TEXT,
  submitted_name TEXT,
  submitted_email TEXT,
  linked_manga_id TEXT,
  catalog_id TEXT,
  scanned_isbn TEXT,
  series TEXT,
  title TEXT,
  volume REAL,
  isbn TEXT,
  author TEXT,
  translator TEXT,
  publisher TEXT,
  distributor TEXT,
  publish_date TEXT,
  pages INTEGER,
  size TEXT,
  price INTEGER,
  cover_url TEXT,
  note TEXT,
  gift_urls TEXT DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  reject_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  title TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Series tracking
CREATE TABLE IF NOT EXISTS series_metadata (
  series TEXT PRIMARY KEY,
  total_volumes REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'ongoing',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_series_settings (
  user_id TEXT NOT NULL,
  series TEXT NOT NULL,
  target_volumes REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'collecting',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, series)
);

-- 8. Release calendar
CREATE TABLE IF NOT EXISTS release_calendar (
  id TEXT PRIMARY KEY,
  catalog_id TEXT,
  release_date TEXT NOT NULL,
  series TEXT,
  title TEXT NOT NULL,
  volume REAL,
  publisher TEXT,
  price INTEGER,
  cover_url TEXT,
  edition TEXT DEFAULT 'standard',
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_release_calendar_date ON release_calendar(release_date);
CREATE INDEX IF NOT EXISTS idx_release_calendar_series ON release_calendar(series);
CREATE INDEX IF NOT EXISTS idx_release_calendar_publisher ON release_calendar(publisher);

-- 9. Tracked Schedule Items
CREATE TABLE IF NOT EXISTS user_tracked_schedule (
  user_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, schedule_id)
);

-- 10. User Notification Reads
CREATE TABLE IF NOT EXISTS user_notification_reads (
  user_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'tomorrow', 'today', 'released'
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, schedule_id, event_type)
);


