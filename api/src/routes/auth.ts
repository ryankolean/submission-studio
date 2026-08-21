import { Hono } from "hono";

import type { AppContext, AuthenticatedUser } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../errors.js";
import {
  DEFAULT_PBKDF2_ITERATIONS,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../domain/password.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../domain/tokens.js";
import type { UserRole } from "../domain/user.js";

interface UserRow extends AuthenticatedUser {
  pw_hash: string;
}

/**
 * A hash to check candidate passwords against when no user matched, so an
 * unknown email costs roughly the same work as a wrong password. The value is
 * irrelevant; only the time it takes matters.
 */
const DUMMY_HASH = `pbkdf2-sha256$${DEFAULT_PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

function readString(body: unknown, field: string): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function parseJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export const authRoutes = new Hono<AppContext>();

authRoutes.post("/login", async (c) => {
  const body = await parseJson(c);
  const email = readString(body, "email");
  const password = readString(body, "password");

  if (email === null || password === null) {
    return fail(c, 400, "VALIDATION", "Both email and password are required.");
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, role, pw_hash FROM users WHERE email = ? COLLATE NOCASE",
  )
    .bind(email.trim().toLowerCase())
    .first<UserRow>();

  // Always run the KDF, so an unknown email and a wrong password cost alike.
  const matches = await verifyPassword(password, user?.pw_hash ?? DUMMY_HASH);

  if (user === null || !matches) {
    return fail(c, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  // A password proven correct can be re-stored at the current work factor,
  // which is how DEFAULT_PBKDF2_ITERATIONS rises without a reset.
  if (needsRehash(user.pw_hash, DEFAULT_PBKDF2_ITERATIONS)) {
    const upgraded = await hashPassword(password);
    await c.env.DB.prepare("UPDATE users SET pw_hash = ? WHERE id = ?")
      .bind(upgraded, user.id)
      .run();
  }

  await c.env.DB.prepare(
    "INSERT INTO audit_log (id, user_id, entity, entity_id, action) VALUES (?, ?, 'user', ?, 'login')",
  )
    .bind(crypto.randomUUID(), user.id, user.id)
    .run();

  return c.json({
    access_token: await signAccessToken(c.env.JWT_SECRET, {
      userId: user.id,
      role: user.role as UserRole,
    }),
    refresh_token: await signRefreshToken(c.env.JWT_SECRET, { userId: user.id }),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

authRoutes.post("/refresh", async (c) => {
  const body = await parseJson(c);
  const token = readString(body, "refresh_token");
  if (token === null) return fail(c, 400, "VALIDATION", "A refresh_token is required.");

  const result = await verifyRefreshToken(c.env.JWT_SECRET, token);
  if (!result.ok) return fail(c, 401, "UNAUTHORIZED", "Authentication required.");

  const user = await c.env.DB.prepare("SELECT id, email, name, role FROM users WHERE id = ?")
    .bind(result.payload.sub)
    .first<AuthenticatedUser>();

  if (user === null) return fail(c, 401, "UNAUTHORIZED", "Authentication required.");

  return c.json({
    access_token: await signAccessToken(c.env.JWT_SECRET, {
      userId: user.id,
      role: user.role,
    }),
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
  });
});

authRoutes.get("/me", requireAuth, (c) => c.json(c.get("user")));
