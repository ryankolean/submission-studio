import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { migratedDb } from "./helpers/schema-db.js";
import { EMPTY_SPEC, parsePublicationSpec } from "../src/domain/publication-spec.js";

let db: DatabaseSync;

beforeEach(() => {
  db = migratedDb();
});

afterEach(() => {
  db.close();
});

const rows = () =>
  db.prepare("SELECT * FROM publications ORDER BY id").all() as Array<Record<string, unknown>>;

const byId = (id: string) =>
  db.prepare("SELECT * FROM publications WHERE id = ?").get(id) as Record<string, unknown>;

describe("publication seed", () => {
  it("seeds the eight target outlets", () => {
    expect(rows()).toHaveLength(8);
  });

  it("seeds them under stable ids", () => {
    expect(rows().map((row) => row["id"])).toEqual([
      "pub-brides",
      "pub-carats-and-cake",
      "pub-loverly",
      "pub-over-the-moon",
      "pub-the-anti-bride",
      "pub-the-lane",
      "pub-wed-vibes",
      "pub-wezoree",
    ]);
  });

  it("splits five primary and three secondary outlets", () => {
    const tiers = rows().map((row) => row["tier"]);
    expect(tiers.filter((tier) => tier === "primary")).toHaveLength(5);
    expect(tiers.filter((tier) => tier === "secondary")).toHaveLength(3);
  });

  it("marks every seeded outlet active", () => {
    expect(rows().every((row) => row["active"] === 1)).toBe(true);
  });
});

describe("honesty of the seed", () => {
  it("dates last_verified to when the specs were compiled, not to migration time", () => {
    // No one has checked these against the outlets' live guidelines yet.
    // A later date would assert a verification that did not happen.
    expect(rows().every((row) => row["last_verified"] === "2026-08-16")).toBe(true);
  });

  it("leaves exclusivity policy unknown rather than assuming it is permissive", () => {
    expect(rows().every((row) => row["exclusivity_policy"] === "unknown")).toBe(true);
  });

  it("leaves counts_own_blog_as_published null everywhere it is unknown", () => {
    expect(rows().every((row) => row["counts_own_blog_as_published"] === null)).toBe(true);
  });

  it("records no submission method for the outlet whose route varies", () => {
    expect(byId("pub-brides")["method"]).toBeNull();
  });

  it("flags the paid-placement outlet as mixed", () => {
    expect(byId("pub-brides")["earned_or_paid"]).toBe("mixed");
    const others = rows().filter((row) => row["id"] !== "pub-brides");
    expect(others.every((row) => row["earned_or_paid"] === "earned")).toBe(true);
  });
});

describe("seeded specs parse", () => {
  it("produces a usable spec for every outlet", () => {
    for (const row of rows()) {
      const spec = parsePublicationSpec(String(row["spec_json"]));
      expect(spec, `${String(row["id"])} spec did not parse`).not.toEqual(EMPTY_SPEC);
    }
  });

  it("captures the Loverly image range and required fields", () => {
    const spec = parsePublicationSpec(String(byId("pub-loverly")["spec_json"]));
    expect(spec.imgMin).toBe(25);
    expect(spec.imgMax).toBe(40);
    expect(spec.requirements).toContain("full_vendor_credits");
    expect(spec.requirements).toContain("event_description");
    expect(spec.videoAccepted).toBe(true);
  });

  it("captures the Carats & Cake watermark rule and response window", () => {
    const row = byId("pub-carats-and-cake");
    const spec = parsePublicationSpec(String(row["spec_json"]));
    expect(spec.watermarksAllowed).toBe(false);
    expect(spec.size).toBe("web");
    expect(spec.requirements).toContain("tag_all_vendors");
    expect(row["typical_response_days"]).toBe(56);
  });

  it("leaves image counts null where the outlet publishes none", () => {
    const spec = parsePublicationSpec(String(byId("pub-carats-and-cake")["spec_json"]));
    expect(spec.imgMin).toBeNull();
    expect(spec.imgMax).toBeNull();
  });

  it("records a submission url wherever the design doc supplies one", () => {
    expect(byId("pub-over-the-moon")["submission_url"]).toBe(
      "https://blog.overthemoon.com/submissions",
    );
    expect(byId("pub-loverly")["submission_url"]).toBe(
      "https://loverly.com/tools/submit-wedding",
    );
  });

  it("leaves submission url null rather than inventing one", () => {
    expect(byId("pub-the-anti-bride")["submission_url"]).toBeNull();
  });
});
