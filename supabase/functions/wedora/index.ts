// Wedora server function (Supabase Edge Function, Deno).
// One function, many operations, so it deploys in one paste from the dashboard.
//   GET  ?op=health                      → { sarvam_ok } for the NudgeBee runbook (no auth)
//   POST { op: "features", wedding_id }  → this member's Flagsmith flags (traits from the DATABASE, not the app)
//   POST { op: "submit_expense", ... }   → routes an expense using Flagsmith approval_limits (server key)
//   POST { op: "say", lang, texts }      → translate UI/AI lines into the member's language (Sarvam)
//   POST { op: "parse_wedding", text }   → couple names, date, city from free text (sarvam-105b)
//   POST { op: "parse_budget", text }    → rupees from "18 lakh" / "১৮ লাখ" / "୧୮ ଲକ୍ଷ"
//   POST { op: "suggest_tasks", ... }    → starter tasks per department and ceremony (sarvam-105b)
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const SARVAM = "https://api.sarvam.ai";
const FLAGSMITH = "https://edge.api.flagsmith.com/api/v1";
const env = (k: string) => Deno.env.get(k) ?? "";

function serviceKey(): string {
  const legacy = env("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(env("SUPABASE_SECRET_KEYS"));
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return "";
  }
}
function publicKey(): string {
  const legacy = env("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(env("SUPABASE_PUBLISHABLE_KEYS"));
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return "";
  }
}
const admin = createClient(env("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false } });

// CORS: only our own web origins (phones and NudgeBee send no Origin header). Extra origins via ALLOWED_ORIGINS.
// NOTE: Supabase hosted Edge Functions inject `Access-Control-Allow-Origin: *` on all responses at the
// platform level, overriding the per-origin header set here. The withCors() guard therefore has no effect
// in production hosting. Real access control is enforced by the JWT check in caller() — never rely on
// CORS alone as a security boundary.
const ALLOWED_ORIGINS = new Set([
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "https://yubaraj2000.github.io",
  ...env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean),
]);
const cors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  Vary: "Origin",
};
function withCors(req: Request, res: Response) {
  const origin = req.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) res.headers.set("Access-Control-Allow-Origin", origin);
  return res;
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- AI quota (per user, stored in Postgres so it survives restarts and scaling) ----------
async function takeQuota(userId: string, op: string, cost = 1) {
  const { data, error } = await admin.rpc("ai_take", { p_user: userId, p_op: op, p_cost: cost });
  if (error) {
    console.error("quota check failed", error.message);
    throw new HttpError(503, "Please try again in a moment.");
  }
  if (data !== true) throw new HttpError(429, "You've used Wedora's AI a lot just now. Please wait a little, or use the buttons.");
}
const clip = (v: unknown, max: number) => String(v ?? "").slice(0, max);

// ---------- auth: who is calling, and what is their real role? ----------
type Member = { id: string; wedding_id: string; role: string; language: string; department_id: string | null; display_name: string };

async function caller(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) throw new HttpError(401, "sign in first");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, "invalid session");
  return data.user;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function memberOf(userId: string, weddingId: string): Promise<Member> {
  if (!UUID.test(weddingId)) throw new HttpError(400, "wedding_id required");
  const { data, error } = await admin
    .from("members")
    .select("id, wedding_id, role, language, department_id, display_name")
    .eq("wedding_id", weddingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(403, "not a member of this wedding");
  return data as Member;
}

async function isFinanceHead(m: Member) {
  if (m.role !== "head" || !m.department_id) return false;
  const { data } = await admin.from("departments").select("is_finance").eq("id", m.department_id).maybeSingle();
  return !!data?.is_finance;
}

// ---------- Flagsmith (server key; traits come from the database) ----------
type Flag = { enabled: boolean; value: unknown };
type Flags = Record<string, Flag>;

function defaultFlags(role: string, financeHead: boolean): Flags {
  const leader = role === "admin" || role === "head";
  return {
    approval_limits: { enabled: true, value: { sub_head: 5000, head: 25000 } },
    ai_voice: { enabled: true, value: null },
    sarvam_model: { enabled: true, value: "sarvam-105b" },
    budget_dashboard: { enabled: role === "admin" || financeHead, value: null },
    ai_task_planner: { enabled: leader, value: null },
    voice_expense: { enabled: role !== "member", value: null },
    invite_people: { enabled: role !== "member", value: null },
    onboarding_mode: { enabled: true, value: "ai_chat" },
    ceremony_suggestions: { enabled: false, value: [] },
  };
}

function parseValue(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim();
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

async function flagsFor(m: Member): Promise<{ flags: Flags; source: string }> {
  const financeHead = await isFinanceHead(m);
  const flags = defaultFlags(m.role, financeHead);
  try {
    const res = await fetch(`${FLAGSMITH}/identities/`, {
      method: "POST",
      headers: { "X-Environment-Key": env("FLAGSMITH_SERVER_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: m.id,
        traits: [
          { trait_key: "role", trait_value: m.role },
          { trait_key: "is_finance_head", trait_value: financeHead },
          { trait_key: "language", trait_value: m.language },
          { trait_key: "wedding_id", trait_value: m.wedding_id },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`flagsmith ${res.status}`);
    const body = await res.json();
    for (const f of body.flags ?? []) {
      flags[f.feature.name] = { enabled: !!f.enabled, value: parseValue(f.feature_state_value) };
    }
    return { flags, source: "flagsmith" };
  } catch (e) {
    console.error("flagsmith fallback:", (e as Error).message);
    return { flags, source: "defaults" };
  }
}

// ---------- Sarvam ----------
async function sarvam(path: string, body: unknown) {
  const res = await fetch(`${SARVAM}${path}`, {
    method: "POST",
    headers: { "api-subscription-key": env("SARVAM_API_KEY"), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    console.error(`sarvam ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    throw new HttpError(502, "The AI service is busy right now. Please try again, or use the buttons.");
  }
  return res.json();
}

async function translate(texts: string[], lang: string): Promise<string[]> {
  // Only translate into languages Sarvam supports; fall back to English for anything else.
  if (lang === "en-IN" || !LANG_NAME[lang]) return texts;
  return Promise.all(
    texts.map(async (t) => {
      if (!t.trim()) return t;
      const r = await sarvam("/translate", { input: t, source_language_code: "en-IN", target_language_code: lang });
      return r.translated_text ?? t;
    }),
  );
}

async function chatJSON<T>(system: string, user: string, schema: Record<string, unknown>, model = "sarvam-105b"): Promise<T> {
  const r = await sarvam("/v1/chat/completions", {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    reasoning_effort: null,
    max_tokens: 2048,
    response_format: { type: "json_schema", json_schema: { name: "out", strict: true, schema } },
  });
  const text: string = r.choices?.[0]?.message?.content ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new HttpError(502, "AI returned no JSON");
  return JSON.parse(m[0]) as T;
}

// ---------- money: parse amounts in our own code ----------
const DIGITS: Record<string, string> = {};
["०१२३४५६७८९", "০১২৩৪৫৬৭৮৯", "୦୧୨୩୪୫୬୭୮୯"].forEach((set) => [...set].forEach((ch, i) => (DIGITS[ch] = String(i))));

export function parseIndianAmount(input: string): number | null {
  // Reject inputs that start with a minus sign — negative amounts are invalid.
  if (/^\s*-/.test(input)) return null;
  let s = [...input].map((ch) => DIGITS[ch] ?? ch).join("").toLowerCase().replace(/(\d),(?=\d)/g, "$1").replace(/₹/g, " ");
  s = s.replace(/rs\.?|rupees?|रुपये|रुपए|টাকা|ଟଙ୍କା/g, " ");
  const units: [RegExp, number][] = [
    // "cr" and "crore" use word boundaries (\b) so they don't match substrings inside ASCII words
    // like "script", "credit" or "cricketer". Non-ASCII crore words (करोड़, কোটি, କୋଟି) are matched
    // with a space-or-end anchor because \b doesn't work reliably for non-ASCII in JS.
    [/(\bcrore\b|\bcr\b|(?<=\s|^)करोड़(?=\s|$)|(?<=\s|^)करोड(?=\s|$)|(?<=\s|^)কোটি(?=\s|$)|(?<=\s|^)କୋଟି(?=\s|$))/, 1e7],
    [/(lakh|lac|lakhs|लाख|লাখ|লক্ষ|ଲକ୍ଷ)/, 1e5],
    [/(thousand|hazaar|hazar|k\b|हज़ार|हजार|হাজার|ହଜାର)/, 1e3],
  ];
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  let value = parseFloat(num[1]);
  const after = s.slice(s.indexOf(num[1]) + num[1].length);
  for (const [re, mult] of units) {
    if (re.test(after)) {
      value *= mult;
      break;
    }
  }
  const n = Math.round(value);
  return n > 0 && n <= 1e9 ? n : null;
}

// ---------- operations ----------
let healthCache: { at: number; body: Record<string, unknown> } | null = null;
async function health() {
  if (healthCache && Date.now() - healthCache.at < 15_000) return json({ ...healthCache.body, cached: true });
  const r = await healthCheck();
  healthCache = { at: Date.now(), body: r };
  return json(r);
}
async function healthCheck(): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  // Outage drill (Flagsmith environment flag): report Sarvam as down so the NudgeBee runbook can be shown safely.
  try {
    const res = await fetch(`${FLAGSMITH}/flags/`, {
      headers: { "X-Environment-Key": env("FLAGSMITH_SERVER_KEY") },
      signal: AbortSignal.timeout(3000),
    });
    const flags = (await res.json()) as { feature: { name: string }; enabled: boolean }[];
    if (flags.find((f) => f.feature.name === "sarvam_outage_drill")?.enabled) {
      return { sarvam_ok: false, drill: true, ms: Date.now() - t0 };
    }
  } catch {
    /* Flagsmith unreachable: fall through to the real check */
  }
  try {
    await sarvam("/translate", { input: "hello", source_language_code: "en-IN", target_language_code: "hi-IN" });
    return { sarvam_ok: true, ms: Date.now() - t0 };
  } catch {
    return { sarvam_ok: false, ms: Date.now() - t0 };
  }
}

async function submitExpense(req: Request, body: Record<string, unknown>) {
  const user = await caller(req);
  const m = await memberOf(user.id, String(body.wedding_id));
  const { flags, source } = await flagsFor(m);
  if (body.source === "voice" && !(flags.ai_voice.enabled && flags.voice_expense.enabled)) {
    throw new HttpError(403, "voice expenses are switched off for your level");
  }
  const amount = typeof body.amount === "number" ? Math.round(body.amount) : parseIndianAmount(String(body.amount ?? ""));
  if (!amount || amount <= 0) throw new HttpError(400, "amount must be a positive number of rupees");
  const desc = String(body.description ?? "").trim();
  if (!desc) throw new HttpError(400, "describe the expense");

  const lim = (flags.approval_limits.value ?? {}) as { sub_head?: number; head?: number };
  const sub = Number(lim.sub_head ?? 5000);
  const head = Number(lim.head ?? 25000);

  const { data, error } = await admin.rpc("submit_expense_routed", {
    p_user: user.id,
    p_wedding: m.wedding_id,
    p_amount: amount,
    p_description: desc,
    p_paid_to: String(body.paid_to ?? ""),
    p_source: body.source === "voice" ? "voice" : "form",
    p_sub_limit: sub,
    p_head_limit: head,
  });
  if (error) throw new HttpError(400, error.message);
  return json({ expense: data, limits: { sub_head: sub, head }, flags_source: source });
}

async function parseWedding(userId: string, body: Record<string, unknown>) {
  if (!clip(body.text, 1000).trim()) throw new HttpError(400, "Please tell me about the wedding first.");
  const text = clip(body.text, 1000);
  if (!text.trim()) return json({ bride: "", groom: "", date: "", city: "", admin_name: "" });
  await takeQuota(userId, "parse_wedding");
  const today = new Date().toISOString().slice(0, 10);
  const out = await chatJSON<{ bride: string; groom: string; date: string; city: string; admin_name: string }>(
    `You extract wedding details from what an Indian family member says (any language: Odia, Hindi, Bengali, English, or mixed). Today is ${today}. ` +
      `Return names in their original spelling but written in English letters. date = YYYY-MM-DD of the main wedding day (assume the next upcoming one if no year), or "" if unknown. ` +
      `city = city/town or "". admin_name = the speaker's own name if they said it, else "". Never invent values: use "" when not said.`,
    text,
    {
      type: "object",
      additionalProperties: false,
      required: ["bride", "groom", "date", "city", "admin_name"],
      properties: {
        bride: { type: "string" },
        groom: { type: "string" },
        date: { type: "string" },
        city: { type: "string" },
        admin_name: { type: "string" },
      },
    },
  );
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) out.date = "";
  return json(out);
}

async function parseBudget(userId: string, body: Record<string, unknown>) {
  const text = clip(body.text, 200);
  if (!text.trim()) throw new HttpError(400, "Please type the budget, for example 18 lakh.");
  if (!text.trim()) return json({ budget: null, via: "parser" });
  let budget = parseIndianAmount(text);
  let via = "parser";
  if (!budget) {
    await takeQuota(userId, "parse_budget");
    const out = await chatJSON<{ rupees: number }>(
      "Convert the spoken budget for an Indian wedding into whole rupees. 1 lakh = 100000, 1 crore = 10000000. Return 0 if no amount is given.",
      text,
      { type: "object", additionalProperties: false, required: ["rupees"], properties: { rupees: { type: "integer" } } },
    );
    budget = out.rupees > 0 ? out.rupees : null;
    via = "ai";
  }
  return json({ budget, via });
}

async function suggestTasks(req: Request, body: Record<string, unknown>) {
  const user = await caller(req);
  const m = await memberOf(user.id, String(body.wedding_id));
  const { flags } = await flagsFor(m);
  if (!flags.ai_voice.enabled || !flags.ai_task_planner.enabled) throw new HttpError(403, "AI task planner is off for your level");
  await takeQuota(user.id, "suggest_tasks", 5);

  const events = ((body.events ?? []) as { key: string; en: string }[]).slice(0, 20).map((e) => ({ key: clip(e.key, 60), en: clip(e.en, 80) }));
  const departments = ((body.departments ?? []) as { id: string; name: string }[]).slice(0, 20).map((d) => ({ id: clip(d.id, 40), name: clip(d.name, 60) }));
  const lang = String(body.lang ?? m.language);
  const out = await chatJSON<{ tasks: { department: string; title: string; event_key: string }[] }>(
    "You plan an Indian family wedding. For each department give 2-3 short, concrete starter tasks (max 8 words each, English, imperative), " +
      "linked to one of the given ceremonies by event_key when relevant, otherwise event_key = \"\". Use the department names exactly as given. Max 18 tasks.",
    JSON.stringify({ ceremonies: events, departments: departments.map((d) => d.name) }),
    {
      type: "object",
      additionalProperties: false,
      required: ["tasks"],
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["department", "title", "event_key"],
            properties: { department: { type: "string" }, title: { type: "string" }, event_key: { type: "string" } },
          },
        },
      },
    },
    String(flags.sarvam_model.value ?? "sarvam-105b"),
  );
  const byName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
  const keys = new Set(events.map((e) => e.key));
  const tasks = out.tasks
    .map((t) => ({
      department_id: byName.get(t.department.toLowerCase()) ?? null,
      department: t.department,
      title: t.title,
      event_key: keys.has(t.event_key) ? t.event_key : "",
    }))
    .filter((t) => t.department_id);
  const local = await translate(tasks.map((t) => t.title), lang);
  return json({ tasks: tasks.map((t, i) => ({ ...t, local: local[i] })) });
}

// ---------- voice: speech → understood action (confirmed in the app) ----------
const LANG_NAME: Record<string, string> = { "od-IN": "Odia", "hi-IN": "Hindi", "bn-IN": "Bengali", "en-IN": "English" };

// Speech → text only (used during onboarding, before the wedding exists). Quota-limited per user.
async function transcribe(req: Request, form: FormData) {
  const user = await caller(req);
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1500) throw new HttpError(400, "no speech heard");
  if (file.size > 2_000_000) throw new HttpError(413, "That recording is too long. Please keep it under 20 seconds.");
  await takeQuota(user.id, "transcribe", 1);
  const hint = String(form.get("lang") ?? "");
  const stt = new FormData();
  stt.append("file", file, file.name || "speech.m4a");
  stt.append("model", "saaras:v4");
  stt.append("mode", "transcribe");
  stt.append("language_code", LANG_NAME[hint] && hint !== "en-IN" ? hint : "unknown");
  const t0 = Date.now();
  const res = await fetch(`${SARVAM}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": env("SARVAM_API_KEY") },
    body: stt,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    console.error(`transcribe ${res.status}: ${(await res.text()).slice(0, 300)}`);
    throw new HttpError(502, "I couldn't hear that clearly. Please try again, or type it.");
  }
  const b = await res.json();
  return json({ transcript: (b.transcript ?? "").trim(), language: b.language_code ?? hint, ms: Date.now() - t0 });
}

async function voice(req: Request, form: FormData) {
  const user = await caller(req);
  const weddingId = String(form.get("wedding_id") ?? "");
  const m = await memberOf(user.id, weddingId);
  const { flags } = await flagsFor(m);
  if (!flags.ai_voice.enabled) throw new HttpError(403, "AI voice is switched off right now — please use the buttons");
  if (!flags.voice_expense.enabled) throw new HttpError(403, "voice is not switched on for your level yet");

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1500) throw new HttpError(400, "no speech heard");
  if (file.size > 2_000_000) throw new HttpError(413, "That recording is too long. Please keep it under 15 seconds.");
  await takeQuota(user.id, "voice", 3);
  const t0 = Date.now();

  // 1) speech → text (Sarvam Saaras, language auto-detected)
  const stt = new FormData();
  stt.append("file", file, file.name || "speech.m4a");
  stt.append("model", "saaras:v4");
  stt.append("mode", "transcribe");
  // Language hint: the member's chosen language (Odia can be mistaken for Hindi/Marathi), "auto" → detect.
  const hint = String(form.get("lang") ?? m.language);
  stt.append("language_code", LANG_NAME[hint] && hint !== "en-IN" ? hint : "unknown");
  const sttRes = await fetch(`${SARVAM}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": env("SARVAM_API_KEY") },
    body: stt,
    signal: AbortSignal.timeout(30000),
  });
  if (!sttRes.ok) {
    console.error(`speech-to-text ${sttRes.status}: ${(await sttRes.text()).slice(0, 300)}`);
    throw new HttpError(502, "I couldn't hear that clearly. Please try again, or use the buttons.");
  }
  const sttBody = await sttRes.json();
  const transcript: string = (sttBody.transcript ?? "").trim();
  let lang: string = sttBody.language_code ?? m.language;
  if (!LANG_NAME[lang]) lang = m.language;
  const tStt = Date.now() - t0;
  if (!transcript) return json({ transcript: "", language: lang, action: { intent: "none" }, reply: await translate(["I didn't hear anything. Please try again."], lang).then((x) => x[0]), ms: { stt: tStt } });

  // 2) understand, with conversation memory: the pending action (awaiting yes/no) and the last few exchanges.
  let pending: Record<string, unknown> | null = null;
  try {
    const raw = String(form.get("pending") ?? "");
    pending = raw ? JSON.parse(raw.slice(0, 2000)) : null;
  } catch {
    pending = null;
  }
  let history: { role: string; text: string }[] = [];
  try {
    history = (JSON.parse(String(form.get("history") ?? "[]").slice(0, 4000)) as { role: string; text: string }[])
      .slice(-6)
      .map((h) => ({ role: h.role === "ai" ? "Wedora" : "Speaker", text: clip(h.text, 300) }));
  } catch {
    history = [];
  }

  // Read what this person may see WITH THEIR OWN PERMISSIONS (RLS), never the service key.
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const asUser = createClient(env("SUPABASE_URL"), publicKey(), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const [{ data: depts }, { data: tasks }] = await Promise.all([
    asUser.from("departments").select("id, name, parent_id").eq("wedding_id", m.wedding_id),
    asUser.from("tasks").select("id, title, status, department_id").eq("wedding_id", m.wedding_id).neq("status", "cancelled").order("created_at").limit(40),
  ]);
  const myDept = (depts ?? []).find((d) => d.id === m.department_id)?.name ?? "";
  const taskList = (tasks ?? []).map((t, i) => `${i}. ${t.title} [${t.status}]`).join("\n");

  const out = await chatJSON<{
    intent: "expense" | "task" | "task_status" | "ask_status" | "confirm" | "cancel" | "stop" | "none";
    amount_rupees: number;
    description: string;
    paid_to: string;
    task_title: string;
    department: string;
    task_index: number;
    new_status: "pending" | "in_progress" | "completed" | "blocked";
    reply_en: string;
  }>(
    `You are Wedora, a calm and professional wedding operations manager for an Indian family, in a spoken conversation. ` +
      `Speak like an experienced event manager: brief, clear, polite; no exclamation marks, no flattery, no small talk. The speaker is ${m.display_name} ` +
      `(${m.role}${myDept ? ", " + myDept : ""}). They speak ${LANG_NAME[lang] ?? "an Indian language"} (it may be Odia — never confuse Odia with Marathi). ` +
      `Choose ONE intent for their LAST sentence:\n` +
      `- "confirm" / "cancel": ONLY if an action is pending and they say yes (haan, ha, ହଁ, হ্যাঁ, ok, theek hai, kar do) or no (na, nahi, ନା, না, cancel).\n` +
      `- "expense": money paid or to be paid (amount_rupees whole rupees; 1 lakh = 100000; hazaar/हज़ार/হাজার/ହଜାର = 1000).\n` +
      `- "task": asking for new work to be done (task_title).\n` +
      `- "task_status": saying an existing task is done/started/blocked — task_index = the number from the task list below, new_status.\n` +
      `- "ask_status": asking how much was spent or how tasks are going (department = the one asked about, or "").\n` +
      `- "stop": they want to end the conversation (bas, stop, bye, thank you that's all).\n` +
      `- "none": greetings, noise, other people talking, anything unclear.\n` +
      `description/task_title: short English (max 8 words). paid_to: who received money, English letters, or "". ` +
      `department: one of [${(depts ?? []).map((d) => d.name).join(", ")}] or "" (default the speaker's own). task_index: -1 if not a listed task. ` +
      `reply_en: one or two short, professional English sentences. For expense/task: restate the facts and ask "Shall I record it?". For task_status: state what you updated. ` +
      `For none: ask them to repeat. For stop: "Ending the conversation." For ask_status/confirm/cancel: "" (the app answers). Never invent amounts, names or tasks.\n\n` +
      `Pending action awaiting yes/no: ${pending ? JSON.stringify(pending) : "none"}\n` +
      `Tasks this person can see:\n${taskList || "(none)"}\n` +
      `Recent conversation:\n${history.map((h) => `${h.role}: ${h.text}`).join("\n") || "(start)"}`,
    transcript,
    {
      type: "object",
      additionalProperties: false,
      required: ["intent", "amount_rupees", "description", "paid_to", "task_title", "department", "task_index", "new_status", "reply_en"],
      properties: {
        intent: { type: "string", enum: ["expense", "task", "task_status", "ask_status", "confirm", "cancel", "stop", "none"] },
        amount_rupees: { type: "integer" },
        description: { type: "string" },
        paid_to: { type: "string" },
        task_title: { type: "string" },
        department: { type: "string" },
        task_index: { type: "integer" },
        new_status: { type: "string", enum: ["pending", "in_progress", "completed", "blocked"] },
        reply_en: { type: "string" },
      },
    },
    String(flags.sarvam_model.value ?? "sarvam-105b"),
  );
  const tLlm = Date.now() - t0 - tStt;

  const parsed = parseIndianAmount(transcript);
  const amount = parsed ?? (out.amount_rupees > 0 ? out.amount_rupees : 0);
  const dept =
    (depts ?? []).find((d) => d.name.toLowerCase() === out.department.toLowerCase()) ??
    (depts ?? []).find((d) => d.id === m.department_id) ??
    null;
  let intent = out.intent;
  if (intent === "expense" && amount <= 0) intent = "none";
  if (intent === "task" && !out.task_title.trim()) intent = "none";
  if ((intent === "confirm" || intent === "cancel") && !pending) intent = "none";
  const task = intent === "task_status" ? (tasks ?? [])[out.task_index] : undefined;
  if (intent === "task_status" && !task) intent = "none";

  let replyEn = out.reply_en;
  let action: Record<string, unknown> = { intent: "none" };
  if (intent === "expense") {
    action = { intent, amount, description: out.description, paid_to: out.paid_to, amount_source: parsed ? "parser" : "ai" };
  } else if (intent === "task") {
    action = { intent, title: out.task_title, department_id: dept?.id ?? null, department: dept?.name ?? "" };
  } else if (intent === "task_status" && task) {
    action = { intent, task_id: task.id, title: task.title, from: task.status, status: out.new_status };
  } else if (intent === "ask_status") {
    // Numbers come from the database (under this person's RLS), never from the model.
    const scope = out.department && dept ? dept : null;
    const { data: exps } = await asUser.from("expenses").select("amount, status, department_id").eq("wedding_id", m.wedding_id);
    const inScope = (rowDept: string) => !scope || rowDept === scope.id || (depts ?? []).find((d) => d.id === rowDept)?.parent_id === scope.id;
    const ex = (exps ?? []).filter((e) => inScope(e.department_id));
    const ts = (tasks ?? []).filter((t) => inScope(t.department_id));
    const sum = (st: string) => ex.filter((e) => e.status === st).reduce((a, e) => a + Number(e.amount), 0);
    const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
    replyEn =
      `${scope ? scope.name : "Everything you can see"}: ${inr(sum("approved"))} approved, ${inr(sum("pending"))} waiting for approval. ` +
      `${ts.filter((t) => t.status === "completed").length} of ${ts.length} tasks done.`;
    action = { intent };
  } else if (intent === "confirm" || intent === "cancel" || intent === "stop") {
    action = { intent };
    if (intent === "cancel") replyEn = "Understood. I have not recorded it.";
  }
  if (intent === "none" && !replyEn.trim()) replyEn = "I did not catch that. Please say it again.";

  const reply = replyEn.trim() ? (await translate([replyEn], lang))[0] : "";
  return json({ transcript, language: lang, action, reply, reply_en: replyEn, ms: { stt: tStt, llm: tLlm, total: Date.now() - t0 } });
}

async function speak(req: Request, body: Record<string, unknown>) {
  const user = await caller(req);
  if (body.wedding_id) await memberOf(user.id, String(body.wedding_id));
  await takeQuota(user.id, "speak");
  const text = clip(body.text, 1200);
  const lang = LANG_NAME[String(body.lang)] ? String(body.lang) : "hi-IN";
  if (!text.trim()) throw new HttpError(400, "nothing to say");
  // Calm, professional personas (the default v4 persona is an advertising style). Odia has no dedicated
  // persona; any v4 persona reads Odia because the language code selects the language.
  const VOICE: Record<string, string> = {
    "en-IN": "neha_en_customer",
    "hi-IN": "ritu_hi_customer",
    "bn-IN": "arnab_bn_conversation",
    "od-IN": "ritu_hi_customer",
  };
  const r = await sarvam("/text-to-speech", {
    text,
    target_language_code: lang,
    model: "bulbul:v4-flash",
    speaker: VOICE[lang] ?? "neha_en_customer",
    pace: 0.95,
    temperature: 0.35,
  });
  return json({ audio_b64: r.audios?.[0] ?? "", mime: "audio/wav" });
}

// ---------- router ----------
Deno.serve(async (req) => {
  return withCors(req, await route(req));
});

async function route(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.searchParams.get("op") === "health") return await health();
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      return form.get("op") === "transcribe" ? await transcribe(req, form) : await voice(req, form);
    }
    const body = (await req.json()) as Record<string, unknown>;
    switch (body.op) {
      case "features": {
        if (!body.wedding_id) throw new HttpError(400, "wedding_id required");
        const user = await caller(req);
        const m = await memberOf(user.id, String(body.wedding_id));
        const { flags, source } = await flagsFor(m);
        return json({ flags, source, role: m.role });
      }
      case "submit_expense":
        return await submitExpense(req, body);
      case "say": {
        const user = await caller(req);
        const lang = LANG_NAME[String(body.lang)] ? String(body.lang) : "en-IN";
        const texts = ((body.texts ?? []) as unknown[]).slice(0, 30).map((t) => clip(t, 400));
        if (lang !== "en-IN") await takeQuota(user.id, "say", Math.max(1, texts.filter((t) => t.trim()).length));
        return json({ texts: await translate(texts, lang) });
      }
      case "parse_wedding":
        return await parseWedding((await caller(req)).id, body);
      case "parse_budget":
        return await parseBudget((await caller(req)).id, body);
      case "suggest_tasks":
        return await suggestTasks(req, body);
      case "speak":
        return await speak(req, body);
      default:
        throw new HttpError(400, `unknown op ${String(body.op)}`);
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(e);
    return json({ error: e instanceof HttpError ? e.message : "Something went wrong. Please try again." }, status);
  }
}
