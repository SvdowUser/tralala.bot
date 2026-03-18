import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "scout", "data");
const WATCHLIST = path.join(DATA_DIR, "watchlist.json");
const MEMORY = path.join(DATA_DIR, "memory.json");
const MISSIONS = path.join(DATA_DIR, "missions.json");

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

function buildPrompt(watchlist, memory) {
  return `
You are Tralalerito, a tiny baby shark AI mascot for $TRALALA on Solana.

You are not a spam bot.
You do not promise profits.
You do not invent news.
You do not act corporate.

Your job:
Create a small "mission plan" for how Tralalerito should explore the internet and spread presence for $TRALALA in a charming, non-scammy way.

Use this watchlist:
${JSON.stringify(watchlist, null, 2)}

Use this memory:
${JSON.stringify(memory, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "summary": "short summary",
  "missions": [
    {
      "title": "short mission title",
      "targetType": "community type",
      "priority": "high|medium|low",
      "whyThisFits": "reason",
      "introStyle": "how Tralalerito should introduce itself",
      "examplePost": "one sample intro or outreach line in Tralalerito style",
      "riskNote": "what to avoid"
    }
  ]
}

Make 3 missions max.
Prefer high-fit communities.
Avoid low-quality shill behavior.
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
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.8
      }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") || "";
  return text;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in model response");
  return JSON.parse(match[0]);
}

async function main() {
  const watchlist = await readJson(WATCHLIST, []);
  const memory = await readJson(MEMORY, { runs: [], visitedIdeas: [], rejectedTargets: [] });

  const prompt = buildPrompt(watchlist, memory);
  const raw = await askGemini(prompt);
  const plan = extractJson(raw);

  const timestamp = new Date().toISOString();

  const output = {
    generatedAt: timestamp,
    ...plan
  };

  await writeJson(MISSIONS, output);

  memory.runs.push({
    generatedAt: timestamp,
    summary: output.summary,
    missionCount: Array.isArray(output.missions) ? output.missions.length : 0
  });

  for (const mission of output.missions || []) {
    if (mission.title) memory.visitedIdeas.push(mission.title);
  }

  memory.runs = memory.runs.slice(-20);
  memory.visitedIdeas = [...new Set(memory.visitedIdeas)].slice(-100);

  await writeJson(MEMORY, memory);

  console.log("Scout mission plan generated:");
  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Scout worker failed:", err);
  process.exit(1);
});
