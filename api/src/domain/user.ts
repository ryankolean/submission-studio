/**
 * User vocabulary.
 *
 * DECISION: the design doc names a `role` column but never defines its values.
 * Two seeded users exist (design doc section 4), so the vocabulary is the two
 * roles those users hold. `admin` may administer publications and seed data;
 * `photographer` owns the weddings. No signup endpoint exists, so this list only
 * grows through a migration.
 */
export const USER_ROLES = ["admin", "photographer"] as const;

export type UserRole = (typeof USER_ROLES)[number];
