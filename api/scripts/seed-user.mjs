/**
 * Creates a user and mints a single-use password invite.
 *
 * This is the only way a user row comes into existence. There is no signup
 * endpoint and no seeded user in any migration -- the repo is public, so real
 * email addresses stay out of it. Running this requires D1 credentials, which
 * is the access control.
 *
 *   node scripts/seed-user.mjs --email someone@example.com --name "Their Name" \
 *     --role photographer --local
 *
 * Prints the invite link once. It is not written anywhere; if it is lost, run
 * the script again to mint a new one.
 */
import { execFileSync } from "node:child_process";

const DB_NAME = "publication-studio-db";
const TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 7;
const ROLES = ["admin", "photographer"];

function parseArgs(argv) {
  const args = { role: "photographer", appUrl: "http://localhost:5173", target: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--local") args.target = "--local";
    else if (arg === "--remote") args.target = "--remote";
    else if (arg === "--email") args.email = argv[++i];
    else if (arg === "--name") args.name = argv[++i];
    else if (arg === "--role") args.role = argv[++i];
    else if (arg === "--app-url") args.appUrl = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const missing = ["email", "name"].filter((key) => !args[key]);
if (missing.length > 0) {
  console.error(`Missing required argument(s): ${missing.map((m) => `--${m}`).join(", ")}`);
  process.exit(1);
}
if (args.target === null) {
  console.error("Pass --local or --remote so the target database is explicit.");
  process.exit(1);
}
if (!ROLES.includes(args.role)) {
  console.error(`--role must be one of: ${ROLES.join(", ")}`);
  process.exit(1);
}

const base64url = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const token = base64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
const tokenHash = Buffer.from(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
).toString("hex");

const userId = crypto.randomUUID();
const inviteId = crypto.randomUUID();
const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();

/** wrangler d1 execute takes no bind parameters, so values are quoted here. */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

// pw_hash is a placeholder that cannot parse as a real hash, so it can never
// verify against any password. The invite is the only way in.
const sql = [
  `INSERT INTO users (id, email, name, role, pw_hash) VALUES (${q(userId)}, ${q(
    args.email.trim().toLowerCase(),
  )}, ${q(args.name)}, ${q(args.role)}, 'unset');`,
  `INSERT INTO password_invites (id, user_id, token_hash, expires_at) VALUES (${q(
    inviteId,
  )}, ${q(userId)}, ${q(tokenHash)}, ${q(expiresAt)});`,
].join(" ");

try {
  execFileSync("npx", ["wrangler", "d1", "execute", DB_NAME, args.target, "--command", sql], {
    stdio: ["ignore", "ignore", "inherit"],
  });
} catch {
  console.error("\nThe database write failed. Nothing was created.");
  process.exit(1);
}

const link = `${args.appUrl.replace(/\/+$/, "")}/#/set-password?token=${token}`;

console.log(`Created ${args.email} as ${args.role} on the ${args.target.slice(2)} database.`);
console.log(`\nInvite link, valid for ${INVITE_TTL_DAYS} days and usable once:\n\n  ${link}\n`);
console.log("Send it over a channel you trust. It is not stored anywhere.");
