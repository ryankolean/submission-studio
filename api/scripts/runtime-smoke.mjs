/**
 * Smoke tests against the real Workers runtime.
 *
 * The unit suite drives the Hono app in-process, which is fast but is not
 * workerd. That gap is not theoretical: a CORS preflight that returned correct
 * headers under Hono's test harness returned a bare 204 with no headers at all
 * on workerd, which would have broken every authenticated request from the
 * browser while the whole suite stayed green.
 *
 * So the handful of behaviours that depend on runtime semantics -- CORS
 * preflight, empty-body responses, routing and status codes -- are asserted
 * here against `wrangler dev`.
 */
import { spawn } from "node:child_process";

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = "https://ryankolean.github.io";

const failures = [];
let checks = 0;

function check(name, condition, detail = "") {
  checks++;
  if (!condition) failures.push(`${name}${detail === "" ? "" : ` -- ${detail}`}`);
}

const wrangler = spawn(
  "npx",
  [
    "wrangler",
    "dev",
    "--port",
    String(PORT),
    "--var",
    `ALLOWED_ORIGIN:${ORIGIN}`,
    "--var",
    "JWT_SECRET:runtime-smoke-secret",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let stderr = "";
wrangler.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});

const stop = () => {
  wrangler.kill("SIGTERM");
};

process.on("exit", stop);
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});

async function waitForReady() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

if (!(await waitForReady())) {
  console.error("wrangler dev never became ready.");
  console.error(stderr.slice(-2000));
  stop();
  process.exit(1);
}

const preflight = (origin) =>
  fetch(`${BASE}/health`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "authorization",
    },
  });

// CORS preflight from the configured SPA origin.
{
  const response = await preflight(ORIGIN);
  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowHeaders = response.headers.get("access-control-allow-headers") ?? "";

  check("preflight status is 204", response.status === 204, `got ${response.status}`);
  check("preflight allows the SPA origin", allowOrigin === ORIGIN, `got ${allowOrigin}`);
  // Without this the browser refuses to send the bearer token at all.
  check(
    "preflight allows the authorization header",
    allowHeaders.toLowerCase().includes("authorization"),
    `got ${allowHeaders}`,
  );
}

// CORS preflight from anywhere else.
{
  const response = await preflight("https://evil.example");
  check(
    "preflight does not echo a foreign origin",
    response.headers.get("access-control-allow-origin") === null,
    `got ${response.headers.get("access-control-allow-origin")}`,
  );
}

// Actual requests carry the header too.
{
  const response = await fetch(`${BASE}/health`, { headers: { origin: ORIGIN } });
  check(
    "a real response allows the SPA origin",
    response.headers.get("access-control-allow-origin") === ORIGIN,
  );
}

// Routing and auth.
{
  const health = await fetch(`${BASE}/health`);
  check("health responds 200", health.status === 200);
  check("health reports ok", (await health.json()).status === "ok");

  const weddings = await fetch(`${BASE}/weddings`);
  check("weddings rejects anonymous", weddings.status === 401, `got ${weddings.status}`);

  const publications = await fetch(`${BASE}/publications`);
  check("publications rejects anonymous", publications.status === 401);

  const signup = await fetch(`${BASE}/auth/signup`, { method: "POST" });
  check("no signup route exists", signup.status === 404, `got ${signup.status}`);
}

// A 204 with no body is a runtime-semantics case, same family as the CORS bug.
{
  const response = await fetch(`${BASE}/auth/set-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "definitely-not-real", password: "correct horse battery" }),
  });
  check("an unusable invite is rejected", response.status === 400, `got ${response.status}`);
}

stop();

if (failures.length > 0) {
  console.error(`Runtime smoke failed (${failures.length} of ${checks} checks):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`Runtime smoke passed: ${checks} checks against workerd.`);
