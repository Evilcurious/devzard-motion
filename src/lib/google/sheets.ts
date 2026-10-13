import { googleJson } from "./oauth";

export const TABS = {
  customers: "Customers",
  transactions: "Transactions",
  conversations: "Conversations",
  summary: "Summary",
} as const;

const HEADERS = {
  [TABS.customers]: ["id", "name", "email", "phone", "company", "channel", "tags", "notes", "created"],
  [TABS.transactions]: ["id", "date", "type", "category", "amount", "currency", "customer", "description", "source"],
  [TABS.conversations]: ["date", "channel", "customer", "message", "ai_reply", "status"],
  [TABS.summary]: ["metric", "value", "note"],
} as Record<string, string[]>;

async function listSheets(spreadsheetId: string): Promise<{ sheetId: number; title: string }[]> {
  const data = await googleJson<any>(`/sheets/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`);
  return (data.sheets ?? []).map((s: any) => s.properties);
}

export async function createSpreadsheet(title = "Devzard Motion — Business Tracker"): Promise<{ id: string; url: string }> {
  const data = await googleJson<any>("/sheets/v4/spreadsheets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets: Object.values(TABS).map((t) => ({ properties: { title: t } })),
    }),
  });
  return { id: data.spreadsheetId as string, url: data.spreadsheetUrl as string };
}

export async function ensureTabs(spreadsheetId: string): Promise<void> {
  const existing = await listSheets(spreadsheetId);
  const have = new Set(existing.map((s) => s.title));
  const requests = Object.values(TABS)
    .filter((t) => !have.has(t))
    .map((t) => ({ addSheet: { properties: { title: t } } }));
  if (requests.length) {
    await googleJson(`/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    });
  }
  for (const [tab, header] of Object.entries(HEADERS)) {
    await googleJson(
      `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tab)}!A1:${String.fromCharCode(64 + header.length)}1?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: [header] }),
      },
    );
  }
}

export async function writeRange(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> {
  await googleJson(
    `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
}

export async function appendRows(spreadsheetId: string, range: string, values: unknown[][]): Promise<void> {
  await googleJson(
    `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
}

export async function readRange(spreadsheetId: string, range: string): Promise<string[][]> {
  try {
    const data = await googleJson<any>(
      `/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    );
    return (data.values ?? []) as string[][];
  } catch {
    return [];
  }
}

export async function clearRange(spreadsheetId: string, range: string): Promise<void> {
  await googleJson(`/sheets/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
}

/**
 * Upsert rows by their first column (our internal id).
 * Existing rows are updated in place so the sheet stays a stable mirror.
 */
export async function upsertById(
  spreadsheetId: string,
  tab: string,
  rows: unknown[][],
  headerCount: number,
): Promise<{ created: number; updated: number }> {
  if (!rows.length) return { created: 0, updated: 0 };
  const existing = await readRange(spreadsheetId, `${tab}!A2:A`);
  const index = new Map<string, number>();
  existing.forEach((r, i) => {
    if (r[0]) index.set(String(r[0]), i + 2); // sheet rows are 1-based, +1 for header
  });

  const toAppend: unknown[][] = [];
  const updates: { range: string; values: unknown[][] }[] = [];
  let updated = 0;

  for (const row of rows) {
    const id = String(row[0] ?? "");
    const at = id ? index.get(id) : undefined;
    if (at) {
      updates.push({
        range: `${tab}!A${at}:${String.fromCharCode(64 + headerCount)}${at}`,
        values: [row],
      });
      updated++;
    } else {
      toAppend.push(row);
    }
  }

  if (toAppend.length) await appendRows(spreadsheetId, `${tab}!A:${String.fromCharCode(64 + headerCount)}`, toAppend);
  if (updates.length) {
    await googleJson(`/sheets/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: updates }),
    }).catch(async () => {
      for (const u of updates) await writeRange(spreadsheetId, u.range, u.values);
    });
  }
  return { created: toAppend.length, updated };
}

/** Freeze header rows + bold them, so the sheet is actually usable. */
export async function formatHeader(spreadsheetId: string): Promise<void> {
  const sheets = await listSheets(spreadsheetId);
  const requests = sheets.map((s) => ({
    repeatCell: {
      range: { sheetId: s.sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.05, green: 0.09, blue: 0.16 },
          horizontalAlignment: "LEFT",
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
    },
  }));
  await googleJson(`/sheets/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requests }),
  }).catch(() => undefined);
}
