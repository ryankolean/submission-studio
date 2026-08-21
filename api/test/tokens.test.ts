import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/domain/tokens.js";

const SECRET = "test-secret-not-a-real-one";
const OTHER_SECRET = "a-different-secret";
const START = new Date("2026-08-21T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (seconds: number) =>
  vi.setSystemTime(new Date(START.getTime() + seconds * 1000));

describe("token lifetimes", () => {
  it("keeps the access token short-lived", () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(900);
  });

  it("gives the refresh token a longer life than the access token", () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBeGreaterThan(ACCESS_TOKEN_TTL_SECONDS);
  });
});

describe("access tokens", () => {
  it("round-trips subject and role", async () => {
    const token = await signAccessToken(SECRET, { userId: "u1", role: "photographer" });
    const result = await verifyAccessToken(SECRET, token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.sub).toBe("u1");
    expect(result.payload.role).toBe("photographer");
    expect(result.payload.typ).toBe("access");
  });

  it("is still valid one second before expiry", async () => {
    const token = await signAccessToken(SECRET, { userId: "u1", role: "admin" });
    advance(ACCESS_TOKEN_TTL_SECONDS - 1);
    await expect(verifyAccessToken(SECRET, token)).resolves.toMatchObject({ ok: true });
  });

  it("expires after its ttl", async () => {
    const token = await signAccessToken(SECRET, { userId: "u1", role: "admin" });
    advance(ACCESS_TOKEN_TTL_SECONDS + 60);
    await expect(verifyAccessToken(SECRET, token)).resolves.toEqual({
      ok: false,
      code: "TOKEN_EXPIRED",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken(OTHER_SECRET, { userId: "u1", role: "admin" });
    await expect(verifyAccessToken(SECRET, token)).resolves.toEqual({
      ok: false,
      code: "TOKEN_INVALID",
    });
  });

  it("rejects a tampered payload", async () => {
    const token = await signAccessToken(SECRET, { userId: "u1", role: "photographer" });
    const [header, , signature] = token.split(".");
    const forged = btoa(JSON.stringify({ sub: "u1", role: "admin", typ: "access", exp: 9e9 }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    await expect(
      verifyAccessToken(SECRET, `${header}.${forged}.${signature}`),
    ).resolves.toEqual({ ok: false, code: "TOKEN_INVALID" });
  });

  it("rejects malformed input without throwing", async () => {
    for (const bad of ["", "not.a.token", "a.b", "....", "Bearer x"]) {
      await expect(verifyAccessToken(SECRET, bad), bad).resolves.toMatchObject({ ok: false });
    }
  });
});

describe("refresh tokens", () => {
  it("round-trips the subject", async () => {
    const token = await signRefreshToken(SECRET, { userId: "u2" });
    const result = await verifyRefreshToken(SECRET, token);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.sub).toBe("u2");
    expect(result.payload.typ).toBe("refresh");
  });

  it("expires after its ttl", async () => {
    const token = await signRefreshToken(SECRET, { userId: "u2" });
    advance(REFRESH_TOKEN_TTL_SECONDS + 60);
    await expect(verifyRefreshToken(SECRET, token)).resolves.toEqual({
      ok: false,
      code: "TOKEN_EXPIRED",
    });
  });
});

describe("token types are not interchangeable", () => {
  it("refuses a refresh token where an access token is required", async () => {
    const refresh = await signRefreshToken(SECRET, { userId: "u1" });
    await expect(verifyAccessToken(SECRET, refresh)).resolves.toEqual({
      ok: false,
      code: "TOKEN_WRONG_TYPE",
    });
  });

  it("refuses an access token where a refresh token is required", async () => {
    const access = await signAccessToken(SECRET, { userId: "u1", role: "admin" });
    await expect(verifyRefreshToken(SECRET, access)).resolves.toEqual({
      ok: false,
      code: "TOKEN_WRONG_TYPE",
    });
  });
});

describe("secret handling", () => {
  it("refuses to sign with an empty secret", async () => {
    await expect(signAccessToken("", { userId: "u1", role: "admin" })).rejects.toThrow(
      /secret/i,
    );
  });

  it("refuses to verify with an empty secret", async () => {
    const token = await signAccessToken(SECRET, { userId: "u1", role: "admin" });
    await expect(verifyAccessToken("", token)).rejects.toThrow(/secret/i);
  });
});
