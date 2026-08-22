# Publication Studio

A Summit Software Solutions product. Working name — final name TBD.

Two-user web app that helps a wedding photographer get published: tracks weddings with rights, consent, and exclusivity states; encodes per-publication submission specs; generates prep-and-queue submission packages that a human reviews and sends. Built with a wedding photographer as design partner zero.

## Status

**Phase:** 0 (Foundation) — in progress. Auth, schema, publication seed, wedding intake, and the inventory dashboard are built and tested. Deployment is not done.

Remaining for Phase 0: deploy the Worker, apply migrations to remote D1, publish the SPA to GitHub Pages, and create the two real users with `npm run seed-user`.

## Documents

- `docs/publication-studio-design.md` — full product design v1.0: architecture, data model, state machines, workflows, risks, roadmap. Read this first.
- `docs/phase-0-prompt.md` — the executable Phase 0 implementation brief for Claude Code.
- `CLAUDE.md` — conventions and directional guidance for Claude Code sessions in this repo.

## Structure

```
/web   — React + Vite + TS + Tailwind SPA → GitHub Pages
/api   — Cloudflare Worker (Hono) + D1 + R2 → wrangler
/docs  — design + implementation briefs
```

## Working on it

```
npm install
npm test          # 479 tests across both workspaces
npm run typecheck
npm run build     # includes a check that no secret reached the SPA bundle
npm run dev:api   # local Worker on :8787, against local D1
npm run dev:web   # SPA on :5173
```

Migrations run with `npm run migrate:local --workspace @publication-studio/api`.

## Users

There is no signup. A user row is created only by an operator with database
credentials:

```
npm run seed-user --workspace @publication-studio/api -- \
  --email someone@example.com --name "Their Name" --role photographer --local
```

That prints a single-use invite link, valid for seven days, which lets the
person choose their own password. No email addresses are committed to this
repository.

## Non-negotiables

- Prep + queue only. This app never sends a submission; a human clicks send.
- No client images, gallery URLs, invite tokens, or data files in this repo — ever.
- All gate logic (rights, exclusivity) lives server-side.
- Secrets in Wrangler env vars only.
