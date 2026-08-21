import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from "../../src/env.js";
import { migratedDb } from "./schema-db.js";

/**
 * A D1Database backed by in-memory SQLite.
 *
 * D1 is SQLite with an async wrapper, so routes under test run their real SQL
 * against the real migrated schema -- CHECK constraints, foreign keys and all.
 * The shim is not D1 itself; a wrangler dev smoke test covers the gap between
 * this and the deployed runtime.
 */
class ShimStatement implements D1PreparedStatement {
  constructor(
    private readonly db: ReturnType<typeof migratedDb>,
    private readonly query: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new ShimStatement(this.db, this.query, values);
  }

  private prepared() {
    return this.db.prepare(this.query);
  }

  // node:sqlite accepts null, number, bigint, string, and Uint8Array only.
  private args(): Array<null | number | bigint | string | Uint8Array> {
    return this.values.map((value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      if (
        typeof value === "number" ||
        typeof value === "bigint" ||
        typeof value === "string" ||
        value instanceof Uint8Array
      ) {
        return value;
      }
      return String(value);
    });
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.prepared().get(...this.args());
    return (row as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const rows = this.prepared().all(...this.args()) as T[];
    return { results: rows, success: true };
  }

  async run(): Promise<D1Result> {
    this.prepared().run(...this.args());
    return { results: [], success: true };
  }
}

export interface TestD1 extends D1Database {
  /** Escape hatch for arranging fixtures without going through a route. */
  exec(sql: string): void;
  close(): void;
}

export function createTestD1(): TestD1 {
  const db = migratedDb();
  return {
    prepare: (query: string) => new ShimStatement(db, query),
    exec: (sql: string) => db.exec(sql),
    close: () => db.close(),
  };
}
