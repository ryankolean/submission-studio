import { Hono } from "hono";

import type { AppContext } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../errors.js";
import { parsePublicationSpec } from "../domain/publication-spec.js";
import type { PublicationSpec } from "../domain/publication-spec.js";
import type {
  EarnedOrPaid,
  ExclusivityPolicy,
  PublicationTier,
  SubmissionMethod,
} from "../domain/publication.js";

interface PublicationRow {
  id: string;
  name: string;
  tier: PublicationTier;
  method: SubmissionMethod | null;
  submission_url: string | null;
  contact_email: string | null;
  spec_json: string;
  exclusivity_policy: ExclusivityPolicy;
  counts_own_blog_as_published: number | null;
  typical_response_days: number | null;
  earned_or_paid: EarnedOrPaid;
  taste_notes: string | null;
  last_verified: string;
  active: number;
}

interface PublicationView {
  id: string;
  name: string;
  tier: PublicationTier;
  method: SubmissionMethod | null;
  submissionUrl: string | null;
  contactEmail: string | null;
  spec: PublicationSpec;
  exclusivityPolicy: ExclusivityPolicy;
  /** null means unknown, which is not the same as a known false. */
  countsOwnBlogAsPublished: boolean | null;
  typicalResponseDays: number | null;
  earnedOrPaid: EarnedOrPaid;
  tasteNotes: string | null;
  lastVerified: string;
  active: boolean;
}

function toView(row: PublicationRow): PublicationView {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier,
    method: row.method,
    submissionUrl: row.submission_url,
    contactEmail: row.contact_email,
    spec: parsePublicationSpec(row.spec_json),
    exclusivityPolicy: row.exclusivity_policy,
    countsOwnBlogAsPublished:
      row.counts_own_blog_as_published === null ? null : row.counts_own_blog_as_published === 1,
    typicalResponseDays: row.typical_response_days,
    earnedOrPaid: row.earned_or_paid,
    tasteNotes: row.taste_notes,
    lastVerified: row.last_verified,
    active: row.active === 1,
  };
}

// Tier is a priority, not an alphabet: sequencing guidance says lead with a
// primary outlet (design doc section 7.3), so primary sorts first.
const TIER_ORDER = `CASE tier WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END`;

export const publicationRoutes = new Hono<AppContext>();

publicationRoutes.use("*", requireAuth);

publicationRoutes.get("/", async (c) => {
  const includeInactive = c.req.query("include_inactive") !== undefined;
  const where = includeInactive ? "" : "WHERE active = 1";

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM publications ${where} ORDER BY ${TIER_ORDER}, name`,
  ).all<PublicationRow>();

  return c.json({ publications: results.map(toView) });
});

publicationRoutes.get("/:id", async (c) => {
  // Addressed directly, a deactivated outlet is still readable; deactivation
  // removes it from the list, it does not delete the record.
  const row = await c.env.DB.prepare("SELECT * FROM publications WHERE id = ?")
    .bind(c.req.param("id"))
    .first<PublicationRow>();

  if (row === null) return fail(c, 404, "NOT_FOUND", "No such publication.");

  return c.json(toView(row));
});
