import { getDb } from "../db";
import { clearRange, createSpreadsheet, ensureTabs, formatHeader, readRange, upsertById, writeRange, TABS } from "../google/sheets";
import { getGoogleConfig, googleTokens, setJson } from "../settings";
import { summary } from "../finance";
import { logActivity } from "../activity";

export type SyncMode = "push" | "pull" | "both";

export interface SyncReport {
  ok: boolean;
  mode: SyncMode;
  sheetId: string;
  sheetUrl: string;
  customers: { created: number; updated: number };
  transactions: { created: number; updated: number };
  conversations: number;
  imported: { customers: number; transactions: number };
  simulated: boolean;
  error?: string;
}

/** Creates the spreadsheet on first run, then keeps it in sync. */
export async function syncSheet(mode: SyncMode = "both"): Promise<SyncReport> {
  const cfg = await getGoogleConfig();
  const tokens = googleTokens(cfg);
  const base: SyncReport = {
    ok: false,
    mode,
    sheetId: cfg.sheetId,
    sheetUrl: cfg.sheetUrl,
    customers: { created: 0, updated: 0 },
    transactions: { created: 0, updated: 0 },
    conversations: 0,
    imported: { customers: 0, transactions: 0 },
    simulated: false,
  };

  if (!tokens) {
    return { ...base, ok: true, simulated: true, error: "Google account not connected — nothing was written." };
  }

  try {
    let sheetId = cfg.sheetId;
    let sheetUrl = cfg.sheetUrl;

    if (!sheetId) {
      const created = await createSpreadsheet();
      sheetId = created.id;
      sheetUrl = created.url;
      await setJson("google_config", { ...(await getGoogleConfig()), sheetId, sheetUrl });
      await logActivity("success", "Created Google Sheet for business tracking", { sheetUrl });
    }

    await ensureTabs(sheetId);
    await formatHeader(sheetId);

    const db = await getDb();

    if (mode === "push" || mode === "both") {
      const customers = await db.all<any>("SELECT * FROM customers ORDER BY updated_at DESC");
      base.customers = await upsertById(
        sheetId,
        TABS.customers,
        customers.map((c) => [
          c.id,
          c.name,
          c.email,
          (c.phone ?? "").replace(/^ig:/, ""),
          c.company,
          c.channel,
          c.tags,
          c.notes,
          (c.created_at ?? "").slice(0, 10),
        ]),
        9,
      );

      const txs = await db.all<any>("SELECT * FROM transactions ORDER BY occurred_on DESC");
      const customerNames = new Map<string, string>(customers.map((c) => [c.id, c.name]));
      base.transactions = await upsertById(
        sheetId,
        TABS.transactions,
        txs.map((t) => [
          t.id,
          (t.occurred_on ?? "").slice(0, 10),
          t.kind,
          t.category,
          Number(t.amount),
          t.currency,
          customerNames.get(t.customer_id) ?? "",
          t.description,
          t.source,
        ]),
        9,
      );

      const convos = await db.all<any>(
        `SELECT m.created_at, v.channel, v.customer_name, m.body,
                (SELECT body FROM messages r WHERE r.conversation_id = v.id AND r.role = 'ai' ORDER BY r.created_at DESC LIMIT 1) AS reply,
                v.status
           FROM messages m JOIN conversations v ON v.id = m.conversation_id
          WHERE m.role = 'customer' ORDER BY m.created_at DESC LIMIT 200`,
      );
      await clearRange(sheetId, `${TABS.conversations}!A2:F`);
      if (convos.length) {
        await writeRange(
          sheetId,
          `${TABS.conversations}!A2:F${convos.length + 1}`,
          convos.map((c) => [
            (c.created_at ?? "").slice(0, 19).replace("T", " "),
            c.channel,
            c.customer_name,
            (c.body ?? "").slice(0, 500),
            (c.reply ?? "").slice(0, 500),
            c.status,
          ]),
        );
      }
      base.conversations = convos.length;

      const s = await summary();
      await writeRange(sheetId, `${TABS.summary}!A2:C`, [
        ["Total income", s.income, "All time"],
        ["Total expense", s.expense, "All time"],
        ["Profit", s.profit, `Margin ${s.margin}%`],
        ["This month income", s.monthIncome, new Date().toISOString().slice(0, 7)],
        ["This month expense", s.monthExpense, new Date().toISOString().slice(0, 7)],
        ["This month profit", s.monthProfit, new Date().toISOString().slice(0, 7)],
        ["Monthly budget", s.budget, `${s.budgetUsedPct}% used`],
        ["Budget remaining", s.budgetLeft, "This month"],
        ["AI spend (month)", s.aiSpendMonth, "Model API costs"],
        ["AI spend (all time)", s.aiSpend, "Model API costs"],
        ["Customers", customers.length, "Synced from app"],
        ["Last sync", new Date().toISOString().slice(0, 19).replace("T", " "), "UTC"],
      ]);
    }

    if (mode === "pull" || mode === "both") {
      base.imported = await pullFromSheet(sheetId);
    }

    base.ok = true;
    base.sheetId = sheetId;
    base.sheetUrl = sheetUrl;
    await logActivity("success", "Google Sheet synced", {
      customers: base.customers,
      transactions: base.transactions,
      imported: base.imported,
    });
    return base;
  } catch (err) {
    const message = (err as Error).message;
    await logActivity("error", `Sheet sync failed: ${message}`);
    return { ...base, error: message };
  }
}

/**
 * Two-way: anything typed straight into the sheet is pulled back into the app.
 * Rows carry our internal id in column A, so edits are idempotent.
 */
export async function pullFromSheet(sheetId: string): Promise<{ customers: number; transactions: number }> {
  const db = await getDb();
  let customers = 0;
  let transactions = 0;

  const custRows = await readRange(sheetId, `${TABS.customers}!A2:I`);
  for (const r of custRows) {
    const [id, name, email, phone, company, channel, tags, notes] = r;
    if (!name?.trim()) continue;
    if (id) {
      const exists = await db.get("SELECT id FROM customers WHERE id = ?", [id]);
      if (exists) {
        await db.run(
          "UPDATE customers SET name = ?, email = ?, phone = ?, company = ?, tags = ?, notes = ?, updated_at = ? WHERE id = ?",
          [name, email ?? "", phone ?? "", company ?? "", tags ?? "", notes ?? "", new Date().toISOString(), id],
        );
        customers++;
        continue;
      }
    }
    const newId = id && id.length > 8 ? id : undefined;
    await db.run(
      `INSERT INTO customers (id, name, email, phone, company, channel, tags, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, phone = excluded.phone,
         company = excluded.company, tags = excluded.tags, notes = excluded.notes, updated_at = excluded.updated_at`,
      [
        newId ?? `cus_${Math.random().toString(36).slice(2, 14)}`,
        name,
        email ?? "",
        phone ?? "",
        company ?? "",
        channel || "sheet",
        tags ?? "",
        notes ?? "",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );
    customers++;
  }

  const txRows = await readRange(sheetId, `${TABS.transactions}!A2:I`);
  for (const r of txRows) {
    const [id, date, kind, category, amount, currency, customer, description, source] = r;
    const value = Number(String(amount ?? "").replace(/[^0-9.\-]/g, ""));
    if (!value) continue;
    const k = String(kind ?? "").toLowerCase().startsWith("inc") ? "income" : "expense";
    if (id) {
      const exists = await db.get("SELECT id FROM transactions WHERE id = ?", [id]);
      if (exists) {
        await db.run("UPDATE transactions SET kind = ?, amount = ?, category = ?, description = ?, occurred_on = ? WHERE id = ?", [
          k,
          value,
          category || "general",
          description ?? "",
          date ? new Date(date).toISOString() : new Date().toISOString(),
          id,
        ]);
        transactions++;
        continue;
      }
    }
    await db.run(
      `INSERT INTO transactions (id, kind, category, amount, currency, description, customer_id, occurred_on, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET amount = excluded.amount, kind = excluded.kind, category = excluded.category`,
      [
        id && id.length > 6 ? id : `tx_${Math.random().toString(36).slice(2, 14)}`,
        k,
        category || "general",
        value,
        currency || "USD",
        description ?? "",
        date ? new Date(date).toISOString() : new Date().toISOString(),
        source || "sheet",
        new Date().toISOString(),
      ],
    );
    transactions++;
  }

  return { customers, transactions };
}
