import Parser from "rss-parser";
import { readFileSync } from "node:fs";
import { SITE } from "./config.js";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; TheLatinWire/0.2; +https://thelatinwire.com)" },
  customFields: { item: ["source"] },
});

const cfg = JSON.parse(readFileSync(new URL("../feeds.json", import.meta.url)));

const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LINE_RX = Object.fromEntries(["wire", "right", "left", "center"].map((l) => [l, (cfg.lines[l] || []).map((k) => new RegExp(`(^|[^a-z])${esc(k)}([^a-z]|$)`, "i"))]));
export function lineFor(outlet) {
  for (const line of ["wire", "right", "left", "center"]) if (LINE_RX[line].some((rx) => rx.test(outlet))) return line;
  return "center";
}

// Run at most N feed fetches at once; Google News throttles bursts.
async function pool(tasks, n = 4) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) { const t = tasks[i++]; results.push(await t()); }
  }));
  return results;
}

async function parseWithRetry(url) {
  try { return await parser.parseURL(url); }
  catch (e) {
    if (!/429|503|timed? ?out/i.test(String(e.message))) throw e;
    await new Promise((r) => setTimeout(r, 4000));
    return parser.parseURL(url);
  }
}

export async function ingest() {
  const cutoff = Date.now() - SITE.windowHours * 3600 * 1000;
  const items = [];

  await pool(
    cfg.feeds.map((f) => async () => {
      try {
        const feed = await parseWithRetry(encodeURI(f.url));
        for (const it of feed.items || []) {
          const ts = Date.parse(it.isoDate || it.pubDate || "") || Date.now();
          if (ts < cutoff || !it.title || !it.link) continue;
          // Google News items carry the real outlet in <source>, and append " - Outlet" to the title.
          const src = it.source && (typeof it.source === "string" ? it.source : it.source._ || it.source.title);
          const outlet = clean(src || f.outlet);
          let title = clean(it.title);
          if (src && title.endsWith(" - " + outlet)) title = title.slice(0, -(outlet.length + 3));
          items.push({
            id: hash(it.link),
            title,
            link: it.link.trim(),
            snippet: src ? "" : clean(it.contentSnippet || it.content || "").slice(0, 400),
            ts,
            outlet,
            section: f.section,
            line: f.line === "auto" ? lineFor(outlet) : f.line,
            lang: f.lang,
          });
        }
      } catch (e) {
        console.warn(`feed failed: ${f.outlet} ${f.url.slice(0, 60)} (${String(e.message).split("\n")[0]})`);
      }
    })
  );

  // Dedupe by link, then by identical outlet+title (the same article often lands in several queries)
  const seen = new Set();
  return items.filter((i) => {
    const k1 = i.link, k2 = i.outlet + "|" + i.title.toLowerCase();
    if (seen.has(k1) || seen.has(k2)) return false;
    seen.add(k1); seen.add(k2);
    return true;
  });
}

function clean(s) {
  return String(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
