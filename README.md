# Submission Studio

A Summit Software Solutions product. Working name — final name TBD.

Two-user web app that helps a wedding photographer get published: tracks weddings with rights, consent, and exclusivity states; encodes per-publication submission specs; generates prep-and-queue submission packages that a human reviews and sends. Built with a wedding photographer as design partner zero.

## Status

**Phase:** 0 (Foundation) — not started. Design complete and hardened.

## Documents

- `docs/submission-studio-design.md` — full product design v1.0: architecture, data model, state machines, workflows, risks, roadmap. Read this first.
- `docs/phase-0-prompt.md` — the executable Phase 0 implementation brief for Claude Code.
- `CLAUDE.md` — conventions and directional guidance for Claude Code sessions in this repo.

## Planned structure

```
/web   — React + Vite + TS + Tailwind SPA → GitHub Pages
/api   — Cloudflare Worker (Hono) + D1 + R2 → wrangler
/docs  — design + implementation briefs
```

## Non-negotiables

- Prep + queue only. This app never sends a submission; a human clicks send.
- No client images, gallery URLs, invite tokens, or data files in this repo — ever.
- All gate logic (rights, exclusivity) lives server-side.
- Secrets in Wrangler env vars only.
