import { getDb, nowIso, type Row } from "./index";
import { newId } from "./ids";

/** Insert a row. `id` and `created_at` are filled in when absent. */
export async function insert(table: string, values: Row): Promise<string> {
  const db = await getDb();
  const data: Row = { id: values.id ?? newId(), created_at: values.created_at ?? nowIso(), ...values };
  const cols = Object.keys(data);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  await db.run(sql, cols.map((c) => data[c]));
  return String(data.id);
}

export async function update(table: string, id: string, values: Row): Promise<void> {
  const db = await getDb();
  const cols = Object.keys(values).filter((c) => c !== "id");
  if (!cols.length) return;
  const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`;
  await db.run(sql, [...cols.map((c) => values[c]), id]);
}

export async function remove(table: string, id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function byId<T = Row>(table: string, id: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

export async function allWhere<T = Row>(
  table: string,
  where = "1=1",
  params: unknown[] = [],
  orderBy = "",
  limit?: number,
): Promise<T[]> {
  const db = await getDb();
  const sql = `SELECT * FROM ${table} WHERE ${where} ${orderBy} ${limit ? `LIMIT ${Number(limit)}` : ""}`.trim();
  return db.all<T>(sql, params);
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, nowIso()],
  );
}
