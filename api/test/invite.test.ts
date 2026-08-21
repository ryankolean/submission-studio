import { describe, expect, it } from "vitest";

import {
  INVITE_TTL_DAYS,
  createInviteToken,
  hashInviteToken,
  isInviteUsable,
} from "../src/domain/invite.js";

describe("createInviteToken", () => {
  it("returns a url-safe token", async () => {
    const { token } = await createInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("returns enough entropy to be unguessable", async () => {
    const { token } = await createInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("never repeats", async () => {
    const tokens = await Promise.all(
      Array.from({ length: 25 }, async () => (await createInviteToken()).token),
    );
    expect(new Set(tokens).size).toBe(25);
  });

  it("returns the hash alongside, so the caller never has to derive it", async () => {
    const { token, tokenHash } = await createInviteToken();
    await expect(hashInviteToken(token)).resolves.toBe(tokenHash);
  });
});

describe("hashInviteToken", () => {
  it("is stable for the same token", async () => {
    const first = await hashInviteToken("abc");
    expect(await hashInviteToken("abc")).toBe(first);
  });

  it("differs for a different token", async () => {
    expect(await hashInviteToken("abc")).not.toBe(await hashInviteToken("abd"));
  });

  it("does not contain the token", async () => {
    const hash = await hashInviteToken("a-very-distinctive-token");
    expect(hash).not.toContain("a-very-distinctive-token");
  });
});

describe("isInviteUsable", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  const later = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  it("accepts an unused invite that has not expired", () => {
    expect(isInviteUsable({ expiresAt: later(1), usedAt: null }, now)).toBe(true);
  });

  it("refuses an invite that was already used", () => {
    expect(
      isInviteUsable({ expiresAt: later(1), usedAt: "2026-08-21T09:00:00Z" }, now),
    ).toBe(false);
  });

  it("refuses an expired invite", () => {
    expect(isInviteUsable({ expiresAt: later(-1), usedAt: null }, now)).toBe(false);
  });

  it("refuses an invite expiring exactly now, rather than racing the clock", () => {
    expect(isInviteUsable({ expiresAt: now.toISOString(), usedAt: null }, now)).toBe(false);
  });

  it("refuses an invite whose expiry is not a date", () => {
    expect(isInviteUsable({ expiresAt: "whenever", usedAt: null }, now)).toBe(false);
  });

  it("gives an invite a bounded life", () => {
    expect(INVITE_TTL_DAYS).toBeLessThanOrEqual(14);
  });
});
