PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS members (
  group_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_slug, slug),
  FOREIGN KEY (group_slug) REFERENCES groups(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS themes (
  group_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BASIC',
  in_pool TEXT NOT NULL DEFAULT 'true',
  limited INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_slug, slug),
  FOREIGN KEY (group_slug) REFERENCES groups(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bundles (
  manifest_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  group_slug TEXT,
  theme_slug TEXT,
  source_file TEXT NOT NULL,
  checksum TEXT,
  source_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  asset_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT,
  FOREIGN KEY (group_slug) REFERENCES groups(slug) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'image/png',
  size INTEGER NOT NULL DEFAULT 0,
  original_name TEXT,
  source_bundle TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_bundle) REFERENCES bundles(manifest_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asset_aliases (
  alias TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS asset_bindings (
  binding_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  group_slug TEXT,
  theme_slug TEXT,
  member_slug TEXT,
  grade TEXT,
  size_variant TEXT,
  asset_id TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wallpapers (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'free',
  legacy_url TEXT,
  source_alias TEXT,
  asset_id TEXT,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_slug);
CREATE INDEX IF NOT EXISTS idx_themes_group ON themes(group_slug);
CREATE INDEX IF NOT EXISTS idx_assets_source_bundle ON assets(source_bundle);
CREATE INDEX IF NOT EXISTS idx_bindings_group_theme ON asset_bindings(group_slug, theme_slug);
CREATE INDEX IF NOT EXISTS idx_wallpapers_group ON wallpapers(group_name);
