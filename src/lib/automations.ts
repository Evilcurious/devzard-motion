import { getDb } from "./db";
import type { Channel } from "./channels";

export interface AutomationRule {
  id: string;
  name: string;
  enabled: number;
  channel: Channel | "any";
  trigger: "new_message" | "keyword" | "no_reply";
  conditions: {
    keywords?: string;
    minConfidence?: number;
    requireKnowledge?: boolean;
  };
  actions: {
    reply: boolean;
    autoSend: boolean;
    tag?: string;
    markStatus?: string;
    notify?: string;
  };
  run_count: number;
  created_at: string;
}

export function emptyRule(): Omit<AutomationRule, "id" | "run_count" | "created_at"> {
  return {
    name: "New rule",
    enabled: 1,
    channel: "any",
    trigger: "new_message",
    conditions: {},
    actions: { reply: true, autoSend: false },
  };
}

export async function listRules(): Promise<AutomationRule[]> {
  const db = await getDb();
  const rows = await db.all<any>("SELECT * FROM automations ORDER BY created_at ASC");
  return rows.map(parseRule);
}

export async function getRule(id: string): Promise<AutomationRule | undefined> {
  const db = await getDb();
  const row = await db.get<any>("SELECT * FROM automations WHERE id = ?", [id]);
  return row ? parseRule(row) : undefined;
}

function parseRule(row: any): AutomationRule {
  let conditions = {};
  let actions = {};
  try {
    conditions = JSON.parse(row.conditions || "{}");
  } catch {
    /* ignore */
  }
  try {
    actions = JSON.parse(row.actions || "{}");
  } catch {
    /* ignore */
  }
  return { ...row, conditions, actions } as AutomationRule;
}

export async function bumpRunCount(id: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE automations SET run_count = run_count + 1 WHERE id = ?", [id]);
}

export interface RuleContext {
  channel: Channel;
  text: string;
  confidence?: number;
  hasKnowledge: boolean;
}

/** First matching enabled rule wins; falls back to null (use global defaults). */
export function matchRule(rules: AutomationRule[], ctx: RuleContext): AutomationRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.channel !== "any" && rule.channel !== ctx.channel) continue;

    if (rule.trigger === "keyword") {
      const keywords = (rule.conditions.keywords ?? "")
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean);
      if (!keywords.length || !keywords.some((k) => ctx.text.toLowerCase().includes(k))) continue;
    }

    if (rule.conditions.requireKnowledge && !ctx.hasKnowledge) continue;
    if (typeof rule.conditions.minConfidence === "number" && (ctx.confidence ?? 0) < rule.conditions.minConfidence) continue;

    return rule;
  }
  return null;
}
