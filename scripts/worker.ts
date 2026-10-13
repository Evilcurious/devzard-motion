/**
 * Local replacement for the Vercel cron jobs.
 *
 *   npm run worker
 *
 * Env:
 *   WORKER_GMAIL_SECONDS   poll Gmail every N seconds  (default 120)
 *   WORKER_SHEETS_SECONDS  sync Sheets every N seconds (default 900)
 *   WORKER_RUN_ONCE        1 = run both jobs once and exit (handy for CI)
 */
import { syncGmail } from "../src/lib/sync/gmail";
import { syncSheet } from "../src/lib/sync/sheets";

const GMAIL_SECONDS = Number(process.env.WORKER_GMAIL_SECONDS || 120);
const SHEETS_SECONDS = Number(process.env.WORKER_SHEETS_SECONDS || 900);
const RUN_ONCE = process.env.WORKER_RUN_ONCE === "1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gmailLoop() {
  for (;;) {
    try {
      const report = await syncGmail();
      console.log(`[worker] gmail  ${new Date().toISOString()}`, JSON.stringify(report));
    } catch (err) {
      console.error("[worker] gmail failed:", (err as Error).message);
    }
    if (RUN_ONCE) return;
    await sleep(GMAIL_SECONDS * 1000);
  }
}

async function sheetsLoop() {
  for (;;) {
    try {
      const report = await syncSheet("both");
      console.log(`[worker] sheets ${new Date().toISOString()}`, JSON.stringify(report).slice(0, 300));
    } catch (err) {
      console.error("[worker] sheets failed:", (err as Error).message);
    }
    if (RUN_ONCE) return;
    await sleep(SHEETS_SECONDS * 1000);
  }
}

async function main() {
  console.log(
    `[worker] starting — gmail every ${GMAIL_SECONDS}s, sheets every ${SHEETS_SECONDS}s${RUN_ONCE ? " (single run)" : ""}`,
  );
  if (RUN_ONCE) {
    await gmailLoop();
    await sheetsLoop();
    return;
  }
  await Promise.all([gmailLoop(), sheetsLoop()]);
}

void main();
