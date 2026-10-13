import { getDb, nowIso } from "./db";
import { newId } from "./db/ids";
import { insert, remove, update } from "./db/helpers";
import { getFinanceConfig } from "./settings";
import { logActivity } from "./activity";

export interface Transaction {
  id: string;
  kind: "income" | "expense";
  category: string;
  amount: number;
  currency: string;
  description: string;
  customer_id: string;
  occurred_on: string;
  source: string;
  sheet_row: number | null;
  created_at: string;
}

export interface TxInput {
  kind: "income" | "expense";
  amount: number | string;
  category?: string;
  description?: string;
  customer_id?: string;
  occurred_on?: string;
  currency?: string;
  source?: string;
}

export async function addTransaction(input: TxInput): Promise<string> {
  const id = newId("tx");
  const amount = Math.abs(Number(input.amount) || 0);
  const when = input.occurred_on ? new Date(input.occurred_on).toISOString() : nowIso();
  await insert("transactions", {
    id,
    kind: input.kind,
    amount,
    category: input.category?.trim() || "general",
    description: input.description?.trim() || "",
    customer_id: input.customer_id ?? "",
    occurred_on: when,
    currency: input.currency || "USD",
    source: input.source || "manual",
  });
  await logActivity("info", `${input.kind === "income" ? "Income" : "Expense"} logged: ${amount} (${input.category || "general"})`);
  return id;
}

export const updateTransaction = (id: string, patch: Partial<TxInput>) => update("transactions", id, patch as never);
export const deleteTransaction = (id: string) => remove("transactions", id);

export async function listTransactions(limit = 200): Promise<Transaction[]> {
  const db = await getDb();
  return db.all<Transaction>("SELECT * FROM transactions ORDER BY occurred_on DESC LIMIT ?", [limit]);
}

export interface MoneySummary {
  currency: string;
  income: number;
  expense: number;
  profit: number;
  margin: number;
  monthIncome: number;
  monthExpense: number;
  monthProfit: number;
  budget: number;
  budgetUsedPct: number;
  budgetLeft: number;
  aiSpend: number;
  aiBudget: number;
  aiSpendMonth: number;
  categories: { category: string; amount: number; kind: string }[];
  monthly: { month: string; income: number; expense: number; profit: number }[];
  topCustomers: { name: string; revenue: number }[];
}

export async function summary(): Promise<MoneySummary> {
  const db = await getDb();
  const cfg = await getFinanceConfig();
  const monthPrefix = new Date().toISOString().slice(0, 7);

  const totals = (await db.get<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0) AS expense
     FROM transactions`,
  )) ?? { income: 0, expense: 0 };

  const month = (await db.get<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount END), 0) AS income,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0) AS expense
     FROM transactions WHERE substr(occurred_on, 1, 7) = ?`,
    [monthPrefix],
  )) ?? { income: 0, expense: 0 };

  const categories = await db.all<{ category: string; amount: number; kind: string }>(
    `SELECT category, kind, SUM(amount) AS amount FROM transactions
      GROUP BY category, kind ORDER BY amount DESC LIMIT 12`,
  );

  const monthlyRows = await db.all<{ month: string; income: number; expense: number }>(
    `SELECT substr(occurred_on, 1, 7) AS month,
            COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount END), 0) AS expense
       FROM transactions GROUP BY month ORDER BY month DESC LIMIT 12`,
  );

  const ai = (await db.get<{ total: number; month: number }>(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total,
            COALESCE(SUM(CASE WHEN substr(created_at, 1, 7) = ? THEN cost_usd END), 0) AS month
       FROM usage_logs`,
    [monthPrefix],
  )) ?? { total: 0, month: 0 };

  const topCustomers = await db.all<{ name: string; revenue: number }>(
    `SELECT c.name AS name, COALESCE(SUM(t.amount), 0) AS revenue
       FROM transactions t JOIN customers c ON c.id = t.customer_id
      WHERE t.kind = 'income'
      GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 5`,
  );

  const income = Number(totals.income);
  const expense = Number(totals.expense);
  const profit = income - expense;

  return {
    currency: cfg.currency,
    income,
    expense,
    profit,
    margin: income > 0 ? Math.round((profit / income) * 1000) / 10 : 0,
    monthIncome: Number(month.income),
    monthExpense: Number(month.expense),
    monthProfit: Number(month.income) - Number(month.expense),
    budget: cfg.monthlyBudget,
    budgetUsedPct: cfg.monthlyBudget > 0 ? Math.round((Number(month.expense) / cfg.monthlyBudget) * 100) : 0,
    budgetLeft: cfg.monthlyBudget - Number(month.expense),
    aiSpend: round(ai.total),
    aiBudget: cfg.aiBudget,
    aiSpendMonth: round(ai.month),
    categories: categories.map((c) => ({ ...c, amount: Number(c.amount) })),
    monthly: monthlyRows
      .map((m) => ({
        month: m.month,
        income: Number(m.income),
        expense: Number(m.expense),
        profit: Number(m.income) - Number(m.expense),
      }))
      .reverse(),
    topCustomers: topCustomers.map((c) => ({ name: c.name, revenue: Number(c.revenue) })),
  };
}

export async function aiSpendByProvider() {
  const db = await getDb();
  return db.all<{ provider: string; cost: number; calls: number }>(
    `SELECT provider, COALESCE(SUM(cost_usd), 0) AS cost, COUNT(*) AS calls
       FROM usage_logs GROUP BY provider ORDER BY cost DESC`,
  );
}

function round(n: number): number {
  return Math.round(Number(n) * 10000) / 10000;
}

/* ------------------------------------------------------------------ */
/* customers                                                            */
/* ------------------------------------------------------------------ */

export async function listCustomers() {
  const db = await getDb();
  return db.all<{
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    tags: string;
    notes: string;
    channel: string;
    created_at: string;
    messages: number;
    revenue: number;
  }>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM conversations v WHERE v.customer_id = c.id) AS messages,
            (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.customer_id = c.id AND t.kind = 'income') AS revenue
       FROM customers c ORDER BY c.updated_at DESC`,
  );
}

export async function upsertCustomerRecord(input: {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  tags?: string;
  channel?: string;
}): Promise<string> {
  const now = nowIso();
  if (input.id) {
    await update("customers", input.id, { ...input, updated_at: now });
    return input.id;
  }
  const id = newId("cus");
  await insert("customers", {
    id,
    name: input.name,
    email: input.email ?? "",
    phone: input.phone ?? "",
    company: input.company ?? "",
    notes: input.notes ?? "",
    tags: input.tags ?? "",
    channel: input.channel ?? "manual",
    created_at: now,
    updated_at: now,
  });
  return id;
}
