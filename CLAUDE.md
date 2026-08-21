# CLAUDE.md — Submission Studio

Guidance for Claude Code sessions working in this repository.

## What this is

Summit Software Solutions product (working name Submission Studio). Two-user wedding-publication submission tool. Full design: `docs/submission-studio-design.md` (v1.0, hardened). Current implementation brief: `docs/phase-0-prompt.md`.

## First session bootstrap (do this once)

1. If this directory is not yet a GitHub repository remote: `gh repo create ryankolean/submission-studio --public --source=. --push` (confirm repo name with Ryan if he wants the product name instead). The repo is public so GitHub Pages and Actions stay free; see constraint 1 for what that means for content.
2. Verify `git remote -v` shows origin and `main` is pushed.
3. Then execute `docs/phase-0-prompt.md` top to bottom.

## Session protocol

- At session start: read this file, then `docs/submission-studio-design.md` §2 (goals/non-goals), §5 (data model), §6 (state machines), then the current phase prompt in `docs/`.
- Work phase by phase. Do not build ahead of the current phase's scope — later-phase features are explicitly out of scope even if adjacent code makes them tempting.
- Update the Status section in `README.md` when a phase's definition of done is met.
- Commit granularly with conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Push to `main` for Phase 0; feature branches from Phase 1 onward.

## Hard constraints (violations are bugs, not style)

1. **Never commit**: images, `.db`/data files, Pic-Time gallery URLs, invite tokens, or anything from client galleries. Gallery URLs are credentials — server-side (D1) only, never in client bundles, logs, or error messages.
   **This repo is public.** Also keep out: the design partner's name or business, her market and inventory details, candid assessments of her, and the partnership or IP terms. Refer to "the design partner" or "the photographer". The unredacted versions live outside the repo.
2. **Prep + queue only**: no code path may transmit a submission to a publication. No email sending, no form automation, no portal scripting.
3. **Rights gate is server-side law**: packaging/submission endpoints must reject weddings unless `rights_status = own_contract` AND `consent_status IN (granted, granted_limited)`. `second_shooter` weddings route to credit-recovery only.
4. **No signup endpoint.** Two users. A user row is created only by `npm run seed-user` (operator-run, needs D1 credentials), which mints a single-use invite link so the person sets their own password. `POST /auth/set-password` consumes an invite and cannot create a user. No email addresses in the repo.
5. **Secrets in Wrangler env vars.** Nothing secret in the SPA, ever.
6. **Exclusivity ledger** (Phase 2+): hard locks are enforced in the API, with every state change written to `audit_log`.
7. **No emojis in UI or docs.**

## Stack conventions

- `/web`: React 18 + Vite + TypeScript + Tailwind. Deployed to GitHub Pages via Actions.
- `/api`: Cloudflare Worker, Hono router, TypeScript. D1 (SQLite) for data, R2 for curated web-size images (private bucket, Worker-issued signed URLs, 15-min TTL).
- Tests: Vitest for unit (state machines and validators are the priority), one Playwright smoke from Phase 2.
- TypeScript strict mode everywhere. ENUM-like fields use string literal unions mirrored between API types and D1 CHECK constraints.

## Phase map (see design doc §12 for full definitions of done)

- Phase 0: scaffold, auth, schema, publication seed, intake form, inventory dashboard — brief: `docs/phase-0-prompt.md`
- Phase 1: curation board, package generator, queue + mark-sent flow
- Phase 2: exclusivity enforcement, response tracking, withdrawal workflow, credit-recovery module, backups
- Phase 3: Claude API assists (curation suggestions, story drafting), reporting
- Phase 4: multi-tenant generalization — gated on the design partner receiving at least one real acceptance

## When uncertain

Prefer the design doc over improvisation. If the design doc is silent, choose the option that keeps the data model multi-tenant-clean and the SPA untrusted, and leave a `// DECISION:` comment plus a note in the commit message so Ryan sees it.
