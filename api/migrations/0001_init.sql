-- Submission Studio schema v1 -- design doc section 5.
--
-- Conventions:
--   * ids are application-generated UUID text
--   * timestamps are ISO-8601 UTC text (SQLite has no native datetime)
--   * every ENUM-like column carries a CHECK constraint mirroring a TypeScript
--     string-literal union in src/domain; test/schema.test.ts fails on drift
--   * no tenant column yet (single-tenant v1), but no query assumes a single
--     user either, so Phase 4 adds a column rather than a rewrite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'photographer')),
  pw_hash     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS weddings (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  couple_names        TEXT NOT NULL,
  wedding_date        TEXT NOT NULL,
  venue_name          TEXT,
  city                TEXT,
  state               TEXT,
  country             TEXT,

  -- Pic-Time invite-token URL. Treated as a secret: server-side only, never
  -- returned to a client that has not authenticated, never logged.
  gallery_url         TEXT,

  style_tags          TEXT NOT NULL DEFAULT '[]',   -- json array
  unique_angle        TEXT,

  rights_status       TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (rights_status IN ('unverified', 'own_contract', 'second_shooter', 'blocked')),
  consent_status      TEXT NOT NULL DEFAULT 'unverified'
                        CHECK (consent_status IN ('unverified', 'granted', 'granted_limited', 'declined')),
  consent_notes       TEXT,

  -- DECISION: the fields below are required by the section 7.1 intake form but
  -- absent from the section 5 DDL sketch. Added here so intake round-trips.
  name_display        TEXT,           -- e.g. "first names only"
  couple_story        TEXT,           -- intake item 4, raw input for later drafting
  is_destination      INTEGER NOT NULL DEFAULT 0 CHECK (is_destination IN (0, 1)),
  hero_picks          TEXT,           -- intake item 8, free text until the curation board exists
  video_url           TEXT,           -- intake item 9
  target_outlet_notes TEXT,           -- intake item 10

  prior_exposure      TEXT NOT NULL DEFAULT '{}',   -- json: own_blog, ig_posted, prior_pubs

  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- DECISION: exclusivity_state is listed in the design doc as "derived". It is
-- not stored, so it cannot go stale; Phase 2 computes it from the submissions
-- table and the exclusivity ledger.

CREATE INDEX IF NOT EXISTS idx_weddings_rights ON weddings (rights_status, consent_status);

CREATE TABLE IF NOT EXISTS vendor_credits (
  id            TEXT PRIMARY KEY,
  wedding_id    TEXT NOT NULL REFERENCES weddings (id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  business_name TEXT NOT NULL,
  website       TEXT,
  instagram     TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vendor_credits_wedding ON vendor_credits (wedding_id, sort_order);

CREATE TABLE IF NOT EXISTS publications (
  id                            TEXT PRIMARY KEY,
  name                          TEXT NOT NULL,
  tier                          TEXT NOT NULL CHECK (tier IN ('primary', 'secondary', 'dream')),
  method                        TEXT NOT NULL CHECK (method IN ('portal', 'web_form', 'email', 'aggregator')),
  submission_url                TEXT,
  contact_email                 TEXT,
  spec_json                     TEXT NOT NULL DEFAULT '{}',
  exclusivity_policy            TEXT NOT NULL
                                  CHECK (exclusivity_policy IN ('exclusive_required', 'exclusive_preferred', 'non_exclusive', 'unknown')),
  -- NULL means unknown, which is distinct from a known false.
  counts_own_blog_as_published  INTEGER CHECK (counts_own_blog_as_published IN (0, 1)),
  typical_response_days         INTEGER,
  earned_or_paid                TEXT NOT NULL CHECK (earned_or_paid IN ('earned', 'paid', 'mixed')),
  taste_notes                   TEXT,
  last_verified                 TEXT NOT NULL,
  active                        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at                    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at                    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS packages (
  id              TEXT PRIMARY KEY,
  wedding_id      TEXT NOT NULL REFERENCES weddings (id) ON DELETE CASCADE,
  publication_id  TEXT NOT NULL REFERENCES publications (id) ON DELETE RESTRICT,
  image_keys      TEXT NOT NULL DEFAULT '[]',   -- json array of ordered R2 keys
  description_md  TEXT,
  credits_block_md TEXT,
  checklist_json  TEXT NOT NULL DEFAULT '[]',
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_packages_pair ON packages (wedding_id, publication_id, version);

CREATE TABLE IF NOT EXISTS submissions (
  id              TEXT PRIMARY KEY,
  wedding_id      TEXT NOT NULL REFERENCES weddings (id) ON DELETE CASCADE,
  publication_id  TEXT NOT NULL REFERENCES publications (id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'ready', 'queued', 'sent', 'accepted', 'published',
                                      'declined', 'expired', 'withdraw_pending', 'withdrawn', 'cancelled')),
  package_id      TEXT REFERENCES packages (id) ON DELETE SET NULL,
  queued_at       TEXT,
  sent_at         TEXT,
  sent_by         TEXT REFERENCES users (id) ON DELETE SET NULL,
  response_due_at TEXT,
  outcome_at      TEXT,
  outcome_notes   TEXT,
  published_url   TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- One submission per pairing. A resubmission after release is a status
  -- change on this row, which keeps the history in audit_log rather than
  -- spreading it across duplicate rows.
  UNIQUE (wedding_id, publication_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions (status, response_due_at);

CREATE TABLE IF NOT EXISTS credit_requests (
  id                TEXT PRIMARY KEY,
  feature_url       TEXT NOT NULL,
  publication_name  TEXT NOT NULL,
  wedding_id        TEXT REFERENCES weddings (id) ON DELETE SET NULL,
  lead_photographer TEXT,
  lead_contact      TEXT,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'sent', 'granted', 'declined', 'no_response')),
  message_md        TEXT,
  sent_at           TEXT,
  outcome_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  -- Kept on user deletion: the log outlives the actor.
  user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity, entity_id, at);
