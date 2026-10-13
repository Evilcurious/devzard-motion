import path from "node:path";
import fs from "node:fs";

export type Row = Record<string, unknown>;

export interface Db {
  kind: "postgres" | "sqlite";
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function nowIso(): string {
  return new Date().toISOString();
}

/** sqlite is picky: no undefined, no booleans, no raw objects. */
function normalizeParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p !== null && typeof p === "object") return JSON.stringify(p);
    return p;
  });
}

/** `?` placeholders -> postgres `$1..$n` */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/* ------------------------------------------------------------------ */
/* sqlite driver (node:sqlite — built into Node 22+, zero deps)        */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqliteDb = any;

async function createSqlite(file: string): Promise<Db> {
  let DatabaseSync: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]) => SqliteDb;

  try {
    ({ DatabaseSync } = await import("node:sqlite"));
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ DatabaseSync } = require("node:sqlite"));
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw: SqliteDb = new DatabaseSync(file);
  raw.exec("PRAGMA journal_mode = WAL");
  raw.exec("PRAGMA foreign_keys = ON");

  return {
    kind: "sqlite",
    async all<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...normalizeParams(params)) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).get(...normalizeParams(params)) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      const res = raw.prepare(sql).run(...normalizeParams(params));
      return { changes: Number(res?.changes ?? 0) };
    },
  };
}

/* ------------------------------------------------------------------ */
/* postgres driver                                                     */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PgPool = any;

async function createPostgres(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool: PgPool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
    max: 5,
  });

  return {
    kind: "postgres",
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPg(sql), normalizeParams(params));
      return res.rows as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPg(sql), normalizeParams(params));
      return (res.rows[0] as T) ?? undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      const res = await pool.query(toPg(sql), normalizeParams(params));
      return { changes: res.rowCount ?? 0 };
    },
  };
}

/* ------------------------------------------------------------------ */
/* bootstrap                                                           */
/* ------------------------------------------------------------------ */

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  const db = url
    ? await createPostgres(url)
    : await createSqlite(process.env.SQLITE_PATH?.trim() || path.join(process.cwd(), ".data", "devzard.db"));

  const { SCHEMA_SQL } = await import("./schema");
  for (const stmt of SCHEMA_SQL) await db.run(stmt);
  return db;
}

// Cache across hot reloads in dev.
const globalCache = globalThis as unknown as { __devzardDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalCache.__devzardDb) {
    globalCache.__devzardDb = init().catch((err) => {
      globalCache.__devzardDb = undefined;
      throw err;
    });
  }
  return globalCache.__devzardDb;
}
