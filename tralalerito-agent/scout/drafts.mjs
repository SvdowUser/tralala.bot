import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "scout", "data");
const QUEUE = path.join(DATA_DIR, "post_queue.json");
const DRAFTS = path.join(DATA_DIR, "drafts.json");

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
      generationConfig: { temperature: 0.9 }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") || "";
}

function buildPrompt(item) {
  return `
You are Tralalerito, a tiny baby shark AI mascot for $TRALALA on Solana.

Write ONE outreach draft based on this approved mission.

Mission:
${JSON.stringify(item, null, 2)}

Rules:
- broken English, but understandable
- cute, memorable, playful
- not corporate
- not spammy
- no financial promises
- no fake hype
- no fake partnerships
- no price talk
- should feel like a real tiny internet creature
- under 280 characters
- only one draft

Return ONLY valid JSON:
{
  "draftText": "text here",
  "tone": "short tone note",
  "targetAngle": "what kind of community this fits",
  "riskCheck": "what to be careful about"
}
`;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in model response");
  return JSON.parse(match[0]);
}

async function main() {
  const queue = await readJson(QUEUE, { items: [] });
  const drafts = await readJson(DRAFTS, { items: [] });

  const approved = queue.items.filter(x => x.status === "approved");
  const existingIds = new Set(drafts.items.map(x => x.id));

  for (const item of approved) {
    if (existingIds.has(item.id)) continue;

    const raw = await askGemini(buildPrompt(item));
    const parsed = extractJson(raw);

    drafts.items.push({
      id: item.id,
      createdAt: new Date().toISOString(),
      status: "draft",
      sourceMissionId: item.id,
      title: item.title,
      targetType: item.targetType,
      draftText: parsed.draftText || "",
      tone: parsed.tone || "",
      targetAngle: parsed.targetAngle || "",
      riskCheck: parsed.riskCheck || ""
    });
  }

  await writeJson(DRAFTS, drafts);
  console.log("Drafts updated:");
  console.log(JSON.stringify(drafts, null, 2));
}

main().catch((err) => {
  console.error("Draft generation failed:", err);
  process.exit(1);
});
