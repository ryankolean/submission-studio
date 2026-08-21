import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppContext } from "./middleware/auth.js";
import { authRoutes } from "./routes/auth.js";
import { publicationRoutes } from "./routes/publications.js";
import { weddingRoutes } from "./routes/weddings.js";
import { fail } from "./errors.js";

/**
 * There is deliberately no signup route and no user-creation route. Users are
 * created by seed migration only (design doc section 4).
 */
export function createApp() {
  const app = new Hono<AppContext>();

  // CORS is pinned to the SPA origin; anything else gets no allow-origin header.
  app.use("*", (c, next) =>
    cors({
      origin: c.env.ALLOWED_ORIGIN,
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowHeaders: ["authorization", "content-type"],
      maxAge: 86400,
    })(c, next),
  );

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/auth", authRoutes);
  app.route("/publications", publicationRoutes);
  app.route("/weddings", weddingRoutes);

  app.notFound((c) => fail(c, 404, "NOT_FOUND", "No such route."));

  app.onError((error, c) => {
    // Errors may carry gallery URLs or hashes; never return one to a client.
    console.error("unhandled error", error instanceof Error ? error.message : error);
    return fail(c, 500, "INTERNAL", "Something went wrong.");
  });

  return app;
}
