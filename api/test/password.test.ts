import { describe, expect, it } from "vitest";

import {
  DEFAULT_PBKDF2_ITERATIONS,
  hashPassword,
  needsRehash,
  parsePasswordHash,
  verifyPassword,
} from "../src/domain/password.js";

// Keep the work factor tiny in tests; the encoded string carries it, so a hash
// made at 1000 iterations still verifies under any default.
const FAST = { iterations: 1000 };

describe("hashPassword", () => {
  it("produces the documented encoded format", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    expect(encoded).toMatch(/^pbkdf2-sha256\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it("salts each hash independently", async () => {
    const a = await hashPassword("hunter2", FAST);
    const b = await hashPassword("hunter2", FAST);
    expect(a).not.toBe(b);
    expect(parsePasswordHash(a).salt).not.toBe(parsePasswordHash(b).salt);
  });

  it("defaults to the configured iteration count", async () => {
    const encoded = await hashPassword("hunter2");
    expect(parsePasswordHash(encoded).iterations).toBe(DEFAULT_PBKDF2_ITERATIONS);
  });

  it("rejects an empty password", async () => {
    await expect(hashPassword("", FAST)).rejects.toThrow(/password/i);
  });

  it("rejects a non-positive iteration count", async () => {
    await expect(hashPassword("hunter2", { iterations: 0 })).rejects.toThrow(/iterations/i);
  });

  it("handles unicode passwords", async () => {
    const encoded = await hashPassword("pa55wörd–ünïcode", FAST);
    await expect(verifyPassword("pa55wörd–ünïcode", encoded)).resolves.toBe(true);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    await expect(verifyPassword("hunter2", encoded)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    await expect(verifyPassword("hunter3", encoded)).resolves.toBe(false);
  });

  it("rejects an empty password against a real hash", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    await expect(verifyPassword("", encoded)).resolves.toBe(false);
  });

  it("uses the iteration count stored in the hash, not the current default", async () => {
    const encoded = await hashPassword("hunter2", { iterations: 2000 });
    expect(parsePasswordHash(encoded).iterations).toBe(2000);
    await expect(verifyPassword("hunter2", encoded)).resolves.toBe(true);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    for (const bad of [
      "",
      "not-a-hash",
      "pbkdf2-sha256$1000$onlythreeparts",
      "pbkdf2-sha256$notanumber$c2FsdA==$aGFzaA==",
      "bcrypt$1000$c2FsdA==$aGFzaA==",
      "pbkdf2-sha256$0$c2FsdA==$aGFzaA==",
    ]) {
      await expect(verifyPassword("hunter2", bad), bad).resolves.toBe(false);
    }
  });

  it("rejects a hash whose digest length was tampered with", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    const parts = encoded.split("$");
    const truncated = `${parts[0]}$${parts[1]}$${parts[2]}$${parts[3]?.slice(0, 8)}`;
    await expect(verifyPassword("hunter2", truncated)).resolves.toBe(false);
  });
});

describe("parsePasswordHash", () => {
  it("exposes algorithm, iterations, salt, and digest", async () => {
    const encoded = await hashPassword("hunter2", FAST);
    const parsed = parsePasswordHash(encoded);
    expect(parsed.algorithm).toBe("pbkdf2-sha256");
    expect(parsed.iterations).toBe(1000);
    expect(parsed.salt.length).toBeGreaterThan(0);
    expect(parsed.digest.length).toBeGreaterThan(0);
  });

  it("throws on a malformed hash", () => {
    expect(() => parsePasswordHash("nope")).toThrow(/hash/i);
  });
});

describe("needsRehash", () => {
  it("is true when the stored work factor is below target", async () => {
    const encoded = await hashPassword("hunter2", { iterations: 1000 });
    expect(needsRehash(encoded, 2000)).toBe(true);
  });

  it("is false when the stored work factor meets target", async () => {
    const encoded = await hashPassword("hunter2", { iterations: 2000 });
    expect(needsRehash(encoded, 2000)).toBe(false);
  });

  it("is true for a hash it cannot parse, so a bad row gets replaced", () => {
    expect(needsRehash("garbage", 1000)).toBe(true);
  });
});
