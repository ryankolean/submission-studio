import { describe, expect, it } from "vitest";

import { MIN_PASSWORD_LENGTH, checkPasswordPolicy } from "../src/domain/password-policy.js";

const ok = (password: string, email = "partner@example.com") =>
  checkPasswordPolicy(password, email);

describe("checkPasswordPolicy", () => {
  it("accepts a long passphrase", () => {
    expect(ok("correct horse battery staple")).toEqual({ ok: true });
  });

  it("requires a minimum length", () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
    const result = ok("short");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(new RegExp(String(MIN_PASSWORD_LENGTH)));
  });

  it("counts an emoji as one character rather than its code units", () => {
    // Twelve visible characters, more than twelve UTF-16 units.
    const result = ok("aaaaaaaaaaa\u{1F600}");
    expect(result.ok).toBe(true);
  });

  it("rejects a password that is only whitespace padding", () => {
    expect(ok("            ").ok).toBe(false);
  });

  it("rejects the account's own email address", () => {
    expect(ok("partner@example.com").ok).toBe(false);
  });

  it("rejects the email regardless of case", () => {
    expect(ok("PARTNER@EXAMPLE.COM").ok).toBe(false);
  });

  it("rejects an obvious common password", () => {
    for (const password of ["password1234", "123456789012", "qwertyuiopas"]) {
      expect(ok(password).ok, password).toBe(false);
    }
  });

  it("has an upper bound, so a huge input cannot be used to burn cpu", () => {
    expect(ok("a".repeat(5000)).ok).toBe(false);
  });
});
