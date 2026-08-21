/**
 * Access and refresh tokens -- design doc section 4.
 *
 * Signing and verification are delegated to hono/jwt rather than hand-rolled.
 * What lives here is the policy around them: lifetimes, the claim shape, the
 * separation between token types, and typed failures the API can map onto
 * error responses.
 *
 * DECISION: refresh tokens are JWTs with a `typ` claim rather than opaque
 * values stored in D1. Storing them would buy revocation, which matters for a
 * multi-user product; with two seeded users and no signup, it buys a table and
 * a round trip per refresh. Revisit if Phase 4 opens signup.
 */

import { sign, verify } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import { JwtTokenExpired, JwtTokenSignatureMismatched } from "hono/utils/jwt/types";

import type { UserRole } from "./user.js";

/** Short-lived by design: the SPA refreshes rather than holding a long grant. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ALGORITHM = "HS256";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  typ: "access";
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  typ: "refresh";
  iat: number;
  exp: number;
}

export type TokenFailureCode = "TOKEN_INVALID" | "TOKEN_EXPIRED" | "TOKEN_WRONG_TYPE";

export type TokenResult<T> = { ok: true; payload: T } | { ok: false; code: TokenFailureCode };

function requireSecret(secret: string): void {
  if (secret.length === 0) throw new Error("token secret must not be empty");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function signAccessToken(
  secret: string,
  claims: { userId: string; role: UserRole },
): Promise<string> {
  requireSecret(secret);
  const iat = nowSeconds();
  const payload: AccessTokenPayload = {
    sub: claims.userId,
    role: claims.role,
    typ: "access",
    iat,
    exp: iat + ACCESS_TOKEN_TTL_SECONDS,
  };
  // hono/jwt requires an index signature on the payload; the exported claim
  // types stay closed so consumers cannot read undeclared fields.
  return sign(payload as unknown as JWTPayload, secret, ALGORITHM);
}

export async function signRefreshToken(
  secret: string,
  claims: { userId: string },
): Promise<string> {
  requireSecret(secret);
  const iat = nowSeconds();
  const payload: RefreshTokenPayload = {
    sub: claims.userId,
    typ: "refresh",
    iat,
    exp: iat + REFRESH_TOKEN_TTL_SECONDS,
  };
  return sign(payload as unknown as JWTPayload, secret, ALGORITHM);
}

async function verifyTyped<T extends { typ: string; sub: string }>(
  secret: string,
  token: string,
  expectedType: T["typ"],
): Promise<TokenResult<T>> {
  requireSecret(secret);

  let claims: unknown;
  try {
    claims = await verify(token, secret, ALGORITHM);
  } catch (error) {
    if (error instanceof JwtTokenExpired) return { ok: false, code: "TOKEN_EXPIRED" };
    if (error instanceof JwtTokenSignatureMismatched) {
      return { ok: false, code: "TOKEN_INVALID" };
    }
    return { ok: false, code: "TOKEN_INVALID" };
  }

  if (typeof claims !== "object" || claims === null) return { ok: false, code: "TOKEN_INVALID" };

  const payload = claims as Partial<T>;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return { ok: false, code: "TOKEN_INVALID" };
  }
  if (payload.typ !== expectedType) return { ok: false, code: "TOKEN_WRONG_TYPE" };

  return { ok: true, payload: payload as T };
}

export function verifyAccessToken(
  secret: string,
  token: string,
): Promise<TokenResult<AccessTokenPayload>> {
  return verifyTyped<AccessTokenPayload>(secret, token, "access");
}

export function verifyRefreshToken(
  secret: string,
  token: string,
): Promise<TokenResult<RefreshTokenPayload>> {
  return verifyTyped<RefreshTokenPayload>(secret, token, "refresh");
}
