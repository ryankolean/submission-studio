/**
 * Password policy for the set-password flow.
 *
 * Length over composition rules: a long passphrase beats a short string with a
 * symbol bolted on, and composition rules mostly produce predictable mangling.
 */

export const MIN_PASSWORD_LENGTH = 12;

/**
 * PBKDF2 cost is linear in input length only at the first block, but an
 * unbounded field is still a free way to make the server work; nothing
 * legitimate needs more than this.
 */
const MAX_PASSWORD_LENGTH = 200;

const COMMON = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
];

export type PolicyResult = { ok: true } | { ok: false; message: string };

export function checkPasswordPolicy(password: string, email: string): PolicyResult {
  // Count characters, not UTF-16 units, so an emoji is not worth two.
  const length = [...password].length;

  if (length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  if (length > MAX_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at most ${MAX_PASSWORD_LENGTH} characters.` };
  }

  if (password.trim().length === 0) {
    return { ok: false, message: "A password cannot be only spaces." };
  }

  if (password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return { ok: false, message: "A password cannot be your email address." };
  }

  const lowered = password.toLowerCase();
  if (COMMON.some((common) => lowered.includes(common))) {
    return { ok: false, message: "That password is too easy to guess." };
  }

  return { ok: true };
}
