import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "scout", "data");
const MISSIONS = path.join(DATA_DIR, "missions.json");
const QUEUE = path.join(DATA_DIR, "post_queue.json");

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
    .slice(0, 80);
}

async function main() {
  const missions = await readJson(MISSIONS, { missions: [] });
  const queue = await readJson(QUEUE, { items: [] });

  const existingIds = new Set(queue.items.map((x) => x.id));
  const timestamp = new Date().toISOString();

  for (const mission of missions.missions || []) {
    const id = slugify(mission.title);
    if (!id || existingIds.has(id)) continue;

    queue.items.push({
      id,
      createdAt: timestamp,
      status: "new",
      source: "scout",
      title: mission.title,
      targetType: mission.targetType,
      priority: mission.priority || "medium",
      whyThisFits: mission.whyThisFits || "",
      introStyle: mission.introStyle || "",
      examplePost: mission.examplePost || "",
      riskNote: mission.riskNote || ""
    });

    existingIds.add(id);
  }

  await writeJson(QUEUE, queue);

  console.log("Queue updated:");
  console.log(JSON.stringify(queue, null, 2));
}

main().catch((err) => {
  console.error("Queue generation failed:", err);
  process.exit(1);
});
