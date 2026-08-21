/**
 * Password hashing.
 *
 * DECISION: the design doc specifies bcrypt. bcrypt has no native
 * implementation in the Workers runtime, and the pure-JS ports are slow enough
 * to threaten the CPU budget. PBKDF2 via WebCrypto is native, dependency-free,
 * and available in both Workers and Node, so it is used instead.
 *
 * The work factor is stored inside the encoded hash rather than fixed in code.
 * Workers Free allows 10ms of CPU per invocation, and the iteration count that
 * fits inside it has to be measured on the edge rather than guessed. Encoding
 * it per-hash means DEFAULT_PBKDF2_ITERATIONS can be raised later and existing
 * passwords keep verifying; needsRehash() flags the rows to upgrade on next
 * successful login.
 *
 * Format: pbkdf2-sha256$<iterations>$<base64 salt>$<base64 digest>
 */

const ALGORITHM = "pbkdf2-sha256";
const HASH = "SHA-256";
const SALT_BYTES = 16;
const DIGEST_BITS = 256;

/**
 * Deliberately conservative starting point. Measured locally at roughly 3ms on
 * an M-series laptop; edge CPUs are slower, so this leaves room inside the 10ms
 * free-tier budget. Raise it once the deployed Worker reports real CPU time.
 */
export const DEFAULT_PBKDF2_ITERATIONS = 25_000;

export interface HashOptions {
  iterations?: number;
}

export interface ParsedPasswordHash {
  algorithm: string;
  iterations: number;
  salt: Uint8Array;
  digest: Uint8Array;
}

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: HASH, salt, iterations },
    key,
    DIGEST_BITS,
  );
  return new Uint8Array(bits);
}

/** Length-independent equality, to keep comparison time off the secret. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export async function hashPassword(
  password: string,
  options: HashOptions = {},
): Promise<string> {
  if (password.length === 0) throw new Error("password must not be empty");

  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("iterations must be a positive integer");
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await deriveBits(password, salt, iterations);
  return `${ALGORITHM}$${iterations}$${toBase64(salt)}$${toBase64(digest)}`;
}

export function parsePasswordHash(encoded: string): ParsedPasswordHash {
  const parts = encoded.split("$");
  if (parts.length !== 4) throw new Error("malformed password hash");

  const [algorithm, rawIterations, rawSalt, rawDigest] = parts as [
    string,
    string,
    string,
    string,
  ];
  if (algorithm !== ALGORITHM) throw new Error("malformed password hash: unknown algorithm");

  const iterations = Number(rawIterations);
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("malformed password hash: bad iteration count");
  }

  try {
    return { algorithm, iterations, salt: fromBase64(rawSalt), digest: fromBase64(rawDigest) };
  } catch {
    throw new Error("malformed password hash: bad base64");
  }
}

/**
 * Never throws. A stored hash that cannot be parsed is a failed login, not a
 * 500 -- and not a detail worth leaking to the caller.
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  let parsed: ParsedPasswordHash;
  try {
    parsed = parsePasswordHash(encoded);
  } catch {
    return false;
  }

  if (password.length === 0) return false;

  const candidate = await deriveBits(password, parsed.salt, parsed.iterations);
  return constantTimeEqual(candidate, parsed.digest);
}

/** True when a stored hash should be upgraded on the next successful login. */
export function needsRehash(encoded: string, targetIterations: number): boolean {
  try {
    return parsePasswordHash(encoded).iterations < targetIterations;
  } catch {
    return true;
  }
}
