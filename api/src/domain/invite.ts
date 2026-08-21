/**
 * Single-use password invites -- design doc section 4.
 *
 * An invite is a bearer credential: whoever holds the link can set that user's
 * password. So it is high-entropy, short-lived, single-use, and stored only as
 * a hash, on the same reasoning as the password column.
 */

export const INVITE_TTL_DAYS = 7;

const TOKEN_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 with no salt and no stretching, deliberately. The token is 256 bits
 * of randomness, so there is no dictionary to attack and nothing for a work
 * factor to buy -- unlike a password, which is why that one uses PBKDF2.
 */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export async function createInviteToken(): Promise<{ token: string; tokenHash: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  return { token, tokenHash: await hashInviteToken(token) };
}

export function inviteExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export interface InviteState {
  expiresAt: string;
  usedAt: string | null;
}

export function isInviteUsable(invite: InviteState, now: Date = new Date()): boolean {
  if (invite.usedAt !== null) return false;

  const expiry = Date.parse(invite.expiresAt);
  if (Number.isNaN(expiry)) return false;

  // Strictly greater: an invite expiring this instant is spent.
  return expiry > now.getTime();
}
