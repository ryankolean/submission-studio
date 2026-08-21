import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

/**
 * `node:sqlite` is a prefix-only builtin, so Vite cannot resolve a normal
 * import of it. getBuiltinModule reaches the module without going through the
 * bundler.
 *
 * D1 is SQLite, so applying the real migration files here exercises the actual
 * DDL -- CHECK constraints, foreign keys, defaults -- rather than a mock.
 */
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export function migratedDb(): DatabaseSyncType {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const file of migrationFiles()) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export function tableNames(db: DatabaseSyncType): string[] {
  return db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => String(row["name"]));
}

/** Column names of a table, in declaration order. */
export function columnNames(db: DatabaseSyncType, table: string): string[] {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row["name"]));
}
