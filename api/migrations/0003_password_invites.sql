-- Password invites -- design doc section 4, "passwords set via seeded invite links".
--
-- There is still no signup endpoint. A user row can only be created by an
-- operator running scripts/seed-user.mjs against D1, which also mints the
-- single-use invite that lets that person choose their own password.
--
-- DECISION: the seeded users are NOT written into this migration. The repo is
-- public, so committing the two real email addresses would publish them, which
-- is exactly what CLAUDE.md constraint 1 forbids. The design doc's intent is
-- that no self-serve signup exists; an operator-run command with database
-- credentials satisfies that without putting personal data in git.

CREATE TABLE IF NOT EXISTS password_invites (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Only the hash is stored. A leaked database does not yield usable invite
  -- links, the same reasoning that applies to the password column itself.
  token_hash TEXT NOT NULL UNIQUE,

  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_password_invites_user ON password_invites (user_id);
