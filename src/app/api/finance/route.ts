import { NextResponse } from "next/server";
import { guard, readJson } from "@/lib/api";
import { addTransaction, aiSpendByProvider, deleteTransaction, listTransactions, summary, updateTransaction } from "@/lib/finance";
import { recentActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const [money, transactions, aiByProvider, activity] = await Promise.all([
    summary(),
    listTransactions(),
    aiSpendByProvider(),
    recentActivity(25),
  ]);
  return NextResponse.json({ money, transactions, aiByProvider, activity });
}

export async function POST(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await readJson<{ id?: string; kind?: string; amount?: number | string; category?: string; description?: string; customer_id?: string; occurred_on?: string }>(request);
  const kind = body.kind === "income" ? "income" : "expense";
  if (!Number(body.amount)) return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });

  if (body.id) {
    await updateTransaction(body.id, {
      kind,
      amount: body.amount,
      category: body.category,
      description: body.description,
      customer_id: body.customer_id,
      occurred_on: body.occurred_on,
    });
    return NextResponse.json({ ok: true, id: body.id });
  }
  const id = await addTransaction({
    kind,
    amount: body.amount ?? 0,
    category: body.category,
    description: body.description,
    customer_id: body.customer_id,
    occurred_on: body.occurred_on,
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(request: Request) {
  if (await guard()) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await deleteTransaction(id);
  return NextResponse.json({ ok: true });
}
