import fs from "node:fs/promises";
import path from "node:path";
import { collectLiveSignals } from "./web.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "scout", "data");

const WATCHLIST = path.join(DATA_DIR, "watchlist.json");
const MEMORY = path.join(DATA_DIR, "memory.json");
const MISSIONS = path.join(DATA_DIR, "missions.json");
const QUEUE = path.join(DATA_DIR, "post_queue.json");
const DRAFTS = path.join(DATA_DIR, "drafts.json");
const HISTORY = path.join(DATA_DIR, "history.json");
const STATE = path.join(DATA_DIR, "state.json");
const FEEDBACK = path.join(DATA_DIR, "feedback.json");
const COOLDOWNS = path.join(DATA_DIR, "cooldowns.json");

const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function nowIso() {
  return new Date().toISOString();
}

function isActive(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

function pruneCooldowns(cooldowns) {
  const cleaned = { titles: {}, targetTypes: {} };

  for (const [k, v] of Object.entries(cooldowns.titles || {})) {
    if (isActive(v)) cleaned.titles[k] = v;
  }
  for (const [k, v] of Object.entries(cooldowns.targetTypes || {})) {
    if (isActive(v)) cleaned.targetTypes[k] = v;
  }

  return cleaned;
}

function futureIso(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function summarizeStatuses(queue) {
  const approved = [];
  const rejected = [];
  const done = [];
  const recent = [];

  for (const item of queue.items || []) {
    const row = {
      id: item.id,
      title: item.title,
      targetType: item.targetType,
      status: item.status
    };

    if (item.status === "approved") approved.push(row);
    if (item.status === "rejected") rejected.push(row);
    if (item.status === "done") done.push(row);
    recent.push(row);
  }

  return {
    approved: approved.slice(-10),
    rejected: rejected.slice(-10),
    done: done.slice(-10),
    recent: recent.slice(-20)
  };
}

function buildPrompt({
  watchlist,
  memory,
  queueSummary,
  drafts,
  history,
  state,
  feedback,
  cooldowns,
  webSignals
}) {
  return `
You are Tralalerito, a tiny baby shark AI mascot for $TRALALA on Solana.

Your job is to plan the NEXT scouting missions for internet/community exploration.
You are not a spam bot.
You do not promise profits.
You do not invent news.
You do not repeat yourself if a similar mission already exists.
You learn from history, approvals, rejections, and cooldowns.

Current state:
${JSON.stringify(state, null, 2)}

Watchlist:
${JSON.stringify(watchlist, null, 2)}

Memory:
${JSON.stringify(memory, null, 2)}

Queue summary:
${JSON.stringify(queueSummary, null, 2)}

Drafts:
${JSON.stringify(drafts.items || [], null, 2)}

Recent history:
${JSON.stringify((history.runs || []).slice(-12), null, 2)}

Feedback:
${JSON.stringify(feedback, null, 2)}

Active cooldowns:
${JSON.stringify(cooldowns, null, 2)}

Instructions:
- prefer new angles
- avoid repeating titles or near-duplicate ideas
- avoid target types currently on cooldown
- if a style was approved before, you may continue in that direction
- if a style was rejected, reduce it
- think like a small autonomous scout agent
- keep everything cute, non-scammy, and community-first

Return ONLY valid JSON in this exact format:
{
  "summary": "short summary",
  "focus": "current strategic focus",
  "missions": [
    {
      "title": "short mission title",
      "targetType": "community type",
      "priority": "high|medium|low",
      "whyThisFits": "reason",
      "introStyle": "how Tralalerito should introduce itself",
      "examplePost": "one sample outreach line",
      "riskNote": "what to avoid",
      "liveWhyNow": "why this is timely now",
      "sourceUrls": ["https://example.com"]
    }
  ]
}

Make max 3 missions.
`;
}

async function askGemini(prompt) {
  if (!GEMINI_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY / GOOGLE_API_KEY");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    encodeURIComponent(GEMINI_KEY);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85 }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") || "";
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in model response");
  return JSON.parse(match[0]);
}

async function main() {
  const watchlist = await readJson(WATCHLIST, []);
  const memory = await readJson(MEMORY, { runs: [], visitedIdeas: [], rejectedTargets: [] });
  const queue = await readJson(QUEUE, { items: [] });
  const drafts = await readJson(DRAFTS, { items: [] });
  const history = await readJson(HISTORY, { runs: [] });
  const state = await readJson(STATE, {
    currentFocus: "early exploration",
    lastSummary: "",
    lastRunAt: null,
    lastGeneratedTitles: []
  });
  const feedback = await readJson(FEEDBACK, {
    approvedMissionIds: [],
    rejectedMissionIds: [],
    doneMissionIds: []
  });

  let cooldowns = await readJson(COOLDOWNS, { titles: {}, targetTypes: {} });
  cooldowns = pruneCooldowns(cooldowns);

  const queueSummary = summarizeStatuses(queue);
  const webSignals = await collectLiveSignals({
    watchlist,
    focus: state.currentFocus || "general exploration",
    maxQueries: 4
  });
  const prompt = buildPrompt({
    watchlist,
    memory,
    queueSummary,
    drafts,
    history,
    state,
    feedback,
    cooldowns,
    webSignals
  });

  const allowedUrls = [
    ...new Set(
      webSignals.flatMap((x) => (x.results || []).map((r) => r.url).filter(Boolean))
    )
  ];

  function enforceLiveSources(missions) {
    return (missions || []).map((mission, idx) => {
      const currentUrls = Array.isArray(mission.sourceUrls) ? mission.sourceUrls : [];
      const validUrls = currentUrls.filter((u) => allowedUrls.includes(u));

      let fallbackUrls = [];
      if (validUrls.length === 0) {
        const bestSignal =
          webSignals[idx] ||
          webSignals.find((x) => Array.isArray(x.results) && x.results.length > 0) ||
          null;

        fallbackUrls = bestSignal
          ? (bestSignal.results || []).map((r) => r.url).filter(Boolean).slice(0, 3)
          : [];
      }

      return {
        ...mission,
        sourceUrls: (validUrls.length > 0 ? validUrls : fallbackUrls).slice(0, 3),
        liveWhyNow:
          mission.liveWhyNow ||
          "This mission was anchored to recent live web discovery signals."
      };
    });
  }

  const raw = await askGemini(prompt);
  const plan = extractJson(raw);

  const existingIds = new Set((queue.items || []).map(x => x.id));
  const recentIds = new Set((history.runs || []).flatMap(r => r.generatedIds || []));
  const activeTitleCooldowns = new Set(Object.keys(cooldowns.titles || {}).map(x => x.toLowerCase()));
  const activeTargetCooldowns = new Set(Object.keys(cooldowns.targetTypes || {}).map(x => x.toLowerCase()));

  const filteredMissions = [];
  const generatedIds = [];

  for (const mission of plan.missions || []) {
    const id = slugify(mission.title);
    const titleKey = String(mission.title || "").toLowerCase();
    const targetKey = String(mission.targetType || "").toLowerCase();

    if (!id) continue;
    if (existingIds.has(id)) continue;
    if (recentIds.has(id)) continue;
    if (generatedIds.includes(id)) continue;
    if (activeTitleCooldowns.has(titleKey)) continue;
    if (activeTargetCooldowns.has(targetKey)) continue;

    filteredMissions.push(mission);
    generatedIds.push(id);

    if (mission.title) cooldowns.titles[mission.title] = futureIso(24);
    if (mission.targetType) cooldowns.targetTypes[mission.targetType] = futureIso(12);
  }

  const output = {
    generatedAt: nowIso(),
    summary: plan.summary || "",
    focus: plan.focus || "general exploration",
    missions: filteredMissions
  };

  await writeJson(MISSIONS, output);

  history.runs.push({
    generatedAt: output.generatedAt,
    summary: output.summary,
    focus: output.focus,
    generatedIds,
    generatedTitles: filteredMissions.map(x => x.title),
    missionCount: filteredMissions.length,
    webSignals: webSignals.map((x) => ({
      label: x.label,
      query: x.query,
      topUrls: (x.results || []).map((r) => r.url).slice(0, 3)
    }))
  });
  history.runs = history.runs.slice(-40);

  state.currentFocus = output.focus;
  state.lastSummary = output.summary;
  state.lastRunAt = output.generatedAt;
  state.lastGeneratedTitles = filteredMissions.map(x => x.title).slice(-10);

  memory.runs.push({
    generatedAt: output.generatedAt,
    summary: output.summary,
    missionCount: filteredMissions.length
  });
  for (const mission of filteredMissions) {
    if (mission.title) memory.visitedIdeas.push(mission.title);
  }
  memory.runs = memory.runs.slice(-40);
  memory.visitedIdeas = [...new Set(memory.visitedIdeas)].slice(-150);

  await writeJson(HISTORY, history);
  await writeJson(STATE, state);
  await writeJson(MEMORY, memory);
  await writeJson(COOLDOWNS, cooldowns);

  console.log("Scout mission plan generated:");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Scout worker failed:", err);
  process.exit(1);
});
