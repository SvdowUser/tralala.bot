import crypto from "node:crypto";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE_URL = process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v1";

function ensureKey() {
  if (!FIRECRAWL_API_KEY) {
    throw new Error("Missing FIRECRAWL_API_KEY in environment");
  }
}

async function firecrawl(path, body) {
  ensureKey();

  const res = await fetch(`${FIRECRAWL_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}

function shortText(input, max = 1200) {
  const text = String(input || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function normalizeWatchlist(watchlist) {
  if (!Array.isArray(watchlist)) return [];

  return watchlist
    .map((item) => {
      if (typeof item === "string") {
        return { label: item, query: item };
      }

      if (item && typeof item === "object") {
        return {
          label: item.label || item.name || item.topic || item.query || "unknown",
          query: item.query || item.topic || item.name || item.label || "",
        };
      }

      return null;
    })
    .filter(Boolean)
    .filter((x) => x.query);
}

export async function searchWeb(query, { limit = 5 } = {}) {
  const json = await firecrawl("/search", {
    query,
    limit,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
    },
  });

  const rows = Array.isArray(json?.data?.web)
    ? json.data.web
    : Array.isArray(json?.data)
      ? json.data
      : [];

  return rows.map((row) => ({
    url: row.url || "",
    title: row.title || "",
    description: row.description || "",
    markdown: shortText(row.markdown || row.content || "", 1400),
  }));
}

export async function collectLiveSignals({
  watchlist = [],
  focus = "",
  maxQueries = 4,
} = {}) {
  const normalized = normalizeWatchlist(watchlist);
  const queries = [];

  for (const item of normalized.slice(0, maxQueries)) {
    queries.push({
      label: item.label,
      query: `${item.query} Solana community OR ecosystem OR project`,
    });
  }

  if (queries.length === 0) {
    queries.push(
      { label: "solana builders", query: "Solana builders community projects" },
      { label: "solana education", query: "Solana education tutorials community" },
      { label: "solana memes", query: "Solana meme community creative projects" }
    );
  }

  if (focus && queries.length < maxQueries) {
    queries.push({
      label: "focus",
      query: `Solana ${focus}`,
    });
  }

  const out = [];

  for (const q of queries.slice(0, maxQueries)) {
    try {
      const results = await searchWeb(q.query, { limit: 3 });
      out.push({
        id: crypto.randomUUID(),
        label: q.label,
        query: q.query,
        results,
      });
    } catch (err) {
      out.push({
        id: crypto.randomUUID(),
        label: q.label,
        query: q.query,
        error: err instanceof Error ? err.message : String(err),
        results: [],
      });
    }
  }

  return out;
}
