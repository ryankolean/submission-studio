/**
 * The SPA is served from a public origin and the repo is public. This fails the
 * build if anything that must stay server-side appears in the built output.
 *
 * Design doc section 4: the frontend contains zero secrets and zero data.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;

const FORBIDDEN = [
  { label: "a password hash", pattern: /pbkdf2-sha256\$\d/ },
  { label: "a JWT secret binding", pattern: /JWT_SECRET/ },
  { label: "a password hash column", pattern: /pw_hash/ },
  { label: "a gallery url column", pattern: /gallery_url/ },
  { label: "a Pic-Time gallery host", pattern: /gallery\.[a-z0-9-]+\.(com|net|photos)/i },
  { label: "a signed JWT", pattern: /eyJhbGciOi/ },
  { label: "a Cloudflare account id", pattern: /\b[0-9a-f]{32}\b/ },
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const failures = [];
for (const file of walk(DIST)) {
  const contents = readFileSync(file, "utf8");
  for (const { label, pattern } of FORBIDDEN) {
    const match = pattern.exec(contents);
    if (match !== null) {
      failures.push(`${file}: found ${label} (${match[0].slice(0, 40)})`);
    }
  }
}

if (failures.length > 0) {
  console.error("Bundle check failed. The built SPA must contain no secrets or data.");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Bundle check passed across ${walk(DIST).length} files.`);
