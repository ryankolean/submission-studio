import { beforeEach, afterEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { columnNames, migratedDb, tableNames } from "./helpers/schema-db.js";
import { CONSENT_STATUSES, RIGHTS_STATUSES } from "../src/domain/rights-gate.js";
import { SUBMISSION_STATUSES } from "../src/domain/submission-status.js";
import { CREDIT_REQUEST_STATUSES } from "../src/domain/credit-request.js";
import {
  EARNED_OR_PAID_VALUES,
  EXCLUSIVITY_POLICIES,
  PUBLICATION_TIERS,
  SUBMISSION_METHODS,
} from "../src/domain/publication.js";

let db: DatabaseSync;

beforeEach(() => {
  db = migratedDb();
});

afterEach(() => {
  db.close();
});

const insertUser = (id = "u1") =>
  db
    .prepare(
      "INSERT INTO users (id, email, name, role, pw_hash) VALUES (?, ?, ?, 'photographer', 'x')",
    )
    .run(id, `${id}@example.com`, id);

const insertWedding = (id = "w1", rights = "own_contract", consent = "granted") =>
  db
    .prepare(
      `INSERT INTO weddings (id, slug, couple_names, wedding_date, rights_status, consent_status)
       VALUES (?, ?, 'A and B', '2026-06-01', ?, ?)`,
    )
    .run(id, id, rights, consent);

const insertPublication = (id = "p1") =>
  db
    .prepare(
      `INSERT INTO publications (id, name, tier, method, exclusivity_policy, earned_or_paid, last_verified)
       VALUES (?, ?, 'primary', 'web_form', 'unknown', 'earned', '2026-08-21')`,
    )
    .run(id, id);

describe("migrations", () => {
  it("creates exactly the eight tables from the design doc, plus nothing else", () => {
    expect(tableNames(db)).toEqual([
      "audit_log",
      "credit_requests",
      "packages",
      "publications",
      "submissions",
      "users",
      "vendor_credits",
      "weddings",
    ]);
  });

  it("applies cleanly twice in a row when guarded by IF NOT EXISTS", () => {
    expect(() => migratedDb().close()).not.toThrow();
  });
});

describe("enum drift between TypeScript unions and D1 CHECK constraints", () => {
  const acceptsOnly = (
    values: readonly string[],
    write: (value: string) => void,
  ) => {
    for (const value of values) {
      expect(() => write(value), `expected ${value} to be accepted`).not.toThrow();
    }
    expect(() => write("not_a_real_value")).toThrow(/CHECK constraint failed/);
  };

  it("weddings.rights_status matches RIGHTS_STATUSES", () => {
    let n = 0;
    acceptsOnly(RIGHTS_STATUSES, (value) => insertWedding(`w${n++}`, value, "granted"));
  });

  it("weddings.consent_status matches CONSENT_STATUSES", () => {
    let n = 0;
    acceptsOnly(CONSENT_STATUSES, (value) =>
      insertWedding(`c${n++}`, "own_contract", value),
    );
  });

  it("publications.tier matches PUBLICATION_TIERS", () => {
    let n = 0;
    acceptsOnly(PUBLICATION_TIERS, (value) =>
      db
        .prepare(
          `INSERT INTO publications (id, name, tier, method, exclusivity_policy, earned_or_paid, last_verified)
           VALUES (?, 'x', ?, 'web_form', 'unknown', 'earned', '2026-08-21')`,
        )
        .run(`t${n++}`, value),
    );
  });

  it("publications.method matches SUBMISSION_METHODS", () => {
    let n = 0;
    acceptsOnly(SUBMISSION_METHODS, (value) =>
      db
        .prepare(
          `INSERT INTO publications (id, name, tier, method, exclusivity_policy, earned_or_paid, last_verified)
           VALUES (?, 'x', 'primary', ?, 'unknown', 'earned', '2026-08-21')`,
        )
        .run(`m${n++}`, value),
    );
  });

  it("publications.exclusivity_policy matches EXCLUSIVITY_POLICIES", () => {
    let n = 0;
    acceptsOnly(EXCLUSIVITY_POLICIES, (value) =>
      db
        .prepare(
          `INSERT INTO publications (id, name, tier, method, exclusivity_policy, earned_or_paid, last_verified)
           VALUES (?, 'x', 'primary', 'web_form', ?, 'earned', '2026-08-21')`,
        )
        .run(`e${n++}`, value),
    );
  });

  it("publications.earned_or_paid matches EARNED_OR_PAID_VALUES", () => {
    let n = 0;
    acceptsOnly(EARNED_OR_PAID_VALUES, (value) =>
      db
        .prepare(
          `INSERT INTO publications (id, name, tier, method, exclusivity_policy, earned_or_paid, last_verified)
           VALUES (?, 'x', 'primary', 'web_form', 'unknown', ?, '2026-08-21')`,
        )
        .run(`p${n++}`, value),
    );
  });

  it("submissions.status matches SUBMISSION_STATUSES", () => {
    insertWedding();
    // One publication per status: the (wedding, publication) pair is unique.
    let n = 0;
    acceptsOnly(SUBMISSION_STATUSES, (value) => {
      const pub = `sp${n++}`;
      insertPublication(pub);
      db.prepare(
        "INSERT INTO submissions (id, wedding_id, publication_id, status) VALUES (?, 'w1', ?, ?)",
      ).run(`s-${pub}`, pub, value);
    });
  });

  it("credit_requests.status matches CREDIT_REQUEST_STATUSES", () => {
    let n = 0;
    acceptsOnly(CREDIT_REQUEST_STATUSES, (value) =>
      db
        .prepare(
          "INSERT INTO credit_requests (id, feature_url, publication_name, status) VALUES (?, 'https://x', 'X', ?)",
        )
        .run(`cr${n++}`, value),
    );
  });

  it("users.role is constrained", () => {
    let n = 0;
    acceptsOnly(["admin", "photographer"], (value) =>
      db
        .prepare("INSERT INTO users (id, email, name, role, pw_hash) VALUES (?, ?, 'n', ?, 'x')")
        .run(`r${n}`, `r${n++}@example.com`, value),
    );
  });
});

describe("referential integrity", () => {
  it("rejects a submission pointing at a missing wedding", () => {
    insertPublication();
    expect(() =>
      db
        .prepare(
          "INSERT INTO submissions (id, wedding_id, publication_id, status) VALUES ('s1', 'ghost', 'p1', 'draft')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("rejects a vendor credit pointing at a missing wedding", () => {
    expect(() =>
      db
        .prepare(
          "INSERT INTO vendor_credits (id, wedding_id, role, business_name) VALUES ('v1', 'ghost', 'florist', 'X')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it("deletes vendor credits along with their wedding", () => {
    insertWedding();
    db.prepare(
      "INSERT INTO vendor_credits (id, wedding_id, role, business_name) VALUES ('v1', 'w1', 'florist', 'X')",
    ).run();
    db.prepare("DELETE FROM weddings WHERE id = 'w1'").run();
    const remaining = db.prepare("SELECT COUNT(*) AS n FROM vendor_credits").get();
    expect(remaining?.["n"]).toBe(0);
  });

  it("keeps the audit log when its actor is deleted", () => {
    insertUser();
    db.prepare(
      "INSERT INTO audit_log (id, user_id, entity, entity_id, action) VALUES ('a1', 'u1', 'wedding', 'w1', 'create')",
    ).run();
    db.prepare("DELETE FROM users WHERE id = 'u1'").run();
    const row = db.prepare("SELECT user_id FROM audit_log WHERE id = 'a1'").get();
    expect(row?.["user_id"]).toBeNull();
  });
});

describe("uniqueness", () => {
  it("rejects a duplicate user email", () => {
    insertUser("u1");
    expect(() =>
      db
        .prepare(
          "INSERT INTO users (id, email, name, role, pw_hash) VALUES ('u2', 'u1@example.com', 'n', 'admin', 'x')",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("rejects a duplicate wedding slug", () => {
    insertWedding("w1");
    expect(() =>
      db
        .prepare(
          `INSERT INTO weddings (id, slug, couple_names, wedding_date, rights_status, consent_status)
           VALUES ('w2', 'w1', 'C and D', '2026-07-01', 'unverified', 'unverified')`,
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });

  it("allows only one submission per wedding and publication pair", () => {
    insertWedding();
    insertPublication();
    db.prepare(
      "INSERT INTO submissions (id, wedding_id, publication_id, status) VALUES ('s1', 'w1', 'p1', 'draft')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO submissions (id, wedding_id, publication_id, status) VALUES ('s2', 'w1', 'p1', 'draft')",
        )
        .run(),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

describe("defaults", () => {
  it("stamps created_at and updated_at on a wedding", () => {
    insertWedding();
    const row = db.prepare("SELECT created_at, updated_at FROM weddings WHERE id = 'w1'").get();
    expect(row?.["created_at"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.["updated_at"]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("defaults a new wedding to unverified rights and consent", () => {
    db.prepare(
      "INSERT INTO weddings (id, slug, couple_names, wedding_date) VALUES ('w9', 'w9', 'E and F', '2026-09-01')",
    ).run();
    const row = db
      .prepare("SELECT rights_status, consent_status FROM weddings WHERE id = 'w9'")
      .get();
    expect(row?.["rights_status"]).toBe("unverified");
    expect(row?.["consent_status"]).toBe("unverified");
  });

  it("defaults a publication to active", () => {
    insertPublication();
    const row = db.prepare("SELECT active FROM publications WHERE id = 'p1'").get();
    expect(row?.["active"]).toBe(1);
  });

  it("defaults a submission to draft", () => {
    insertWedding();
    insertPublication();
    db.prepare(
      "INSERT INTO submissions (id, wedding_id, publication_id) VALUES ('s1', 'w1', 'p1')",
    ).run();
    const row = db.prepare("SELECT status FROM submissions WHERE id = 's1'").get();
    expect(row?.["status"]).toBe("draft");
  });
});

describe("intake coverage", () => {
  it("stores every field the section 7.1 intake form collects", () => {
    const columns = columnNames(db, "weddings");
    for (const column of [
      "gallery_url",
      "rights_status",
      "consent_status",
      "consent_notes",
      "name_display",
      "couple_story",
      "wedding_date",
      "venue_name",
      "city",
      "state",
      "country",
      "is_destination",
      "prior_exposure",
      "unique_angle",
      "hero_picks",
      "video_url",
      "target_outlet_notes",
      "style_tags",
    ]) {
      expect(columns, `weddings is missing ${column}`).toContain(column);
    }
  });

  it("stores the vendor credit fields publications ask for", () => {
    expect(columnNames(db, "vendor_credits")).toEqual(
      expect.arrayContaining(["role", "business_name", "website", "instagram"]),
    );
  });
});
