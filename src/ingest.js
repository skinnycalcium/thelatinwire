import Parser from "rss-parser";
import { readFileSync } from "node:fs";
import { SITE } from "./config.js";

const parser = new Parser({ timeout: 15000, headers: { "User-Agent": "TheLatinWire/0.1 (+https://thelatinwire.com)" } });

export async function ingest() {
  const { feeds } = JSON.parse(readFileSync(new URL("../feeds.json", import.meta.url)));
  const cutoff = Date.now() - SITE.windowHours * 3600 * 1000;
  const items = [];

  await Promise.all(
    feeds.map(async (f) => {
      try {
        const feed = await parser.parseURL(f.url);
        for (const it of feed.items || []) {
          const ts = Date.parse(it.isoDate || it.pubDate || "") || Date.now();
          if (ts < cutoff || !it.title || !it.link) continue;
          items.push({
            id: hash(it.link),
            title: clean(it.title),
            link: it.link.trim(),
            snippet: clean(it.contentSnippet || it.content || "").slice(0, 600),
            ts,
            outlet: f.outlet,
            section: f.section,
            line: f.line,
            lang: f.lang,
          });
        }
      } catch (e) {
        console.warn(`feed failed: ${f.outlet} (${e.message})`);
      }
    })
  );

  // Dedupe exact links
  const seen = new Set();
  return items.filter((i) => (seen.has(i.link) ? false : seen.add(i.link)));
}

// Pull the article body so the fact sheet has more than a snippet to work with.
// Best effort only: paywalls and bot walls return nothing, and that's fine.
export async function fetchText(url, maxChars = 3500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 TheLatinWire/0.1" } });
    clearTimeout(t);
    if (!res.ok) return "";
    const html = await res.text();
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => clean(m[1].replace(/<[^>]+>/g, " ")))
      .filter((p) => p.length > 60);
    return paras.join("\n").slice(0, maxChars);
  } catch {
    return "";
  }
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
