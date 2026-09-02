import { SECTIONS, SITE } from "./config.js";

const STOP = new Set(("a an the of to in on for and or with by from at as is are was were be been this that these those it its into over after before " +
  "el la los las un una unos unas de del y o en por para con sin sobre es son fue como que se su sus al lo le les más ya tras").split(" "));

function tokens(title) {
  return new Set(
    title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

// Greedy title clustering within a section. Threshold is deliberately loose;
// the fact sheet step will notice if two unrelated items got merged.
export function clusterSection(items, threshold = 0.3) {
  const clusters = [];
  for (const it of items) {
    it._tok = tokens(it.title);
    let best = null, bestScore = 0;
    for (const c of clusters) {
      const s = jaccard(it._tok, c.tok);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best && bestScore >= threshold) {
      best.items.push(it);
      for (const t of it._tok) best.tok.add(t);
    } else {
      clusters.push({ tok: new Set(it._tok), items: [it] });
    }
  }
  return clusters.map((c) => finalize(c.items));
}

function finalize(items) {
  const outlets = new Set(items.map((i) => i.outlet));
  const lines = new Set(items.map((i) => i.line));
  const newest = Math.max(...items.map((i) => i.ts));
  return {
    key: items.map((i) => i.id).sort().join("+"),
    items: items.sort((a, b) => b.ts - a.ts),
    outlets: [...outlets],
    lines: [...lines],
    newest,
    score: outlets.size * 10 + lines.size * 5 + (newest - (Date.now() - SITE.windowHours * 3600e3)) / 3600e3,
  };
}

// Decide what qualifies. Returns { picks, held } per section.
// held = political stories with enough outlets but only one editorial line.
export function select(clusters, section, alreadyPublished) {
  const sec = SECTIONS.find((s) => s.id === section);
  const picks = [], held = [];
  for (const c of clusters.sort((a, b) => b.score - a.score)) {
    if (c.items.some((i) => alreadyPublished.has(i.link))) continue;
    if (c.outlets.length < 2) continue;
    if (sec.requireTwoLines && c.lines.length < 2) { held.push(c); continue; }
    picks.push(c);
    if (picks.length >= SITE.storiesPerSection) break;
  }
  return { picks, held };
}
