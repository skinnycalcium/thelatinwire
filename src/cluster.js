import Anthropic from "@anthropic-ai/sdk";
import { SECTIONS, SITE } from "./config.js";

const client = new Anthropic();
const MAX_ITEMS = 160; // newest N headlines per section go to the matcher

// Ask a small fast model to group headlines that report the same news event.
// Cross-language and cross-outlet, which is what keyword matching could not do.
export async function clusterSection(items, sectionLabel) {
  const recent = [...items].sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
  if (recent.length < 2) return [];
  try {
    const list = recent.map((it, i) => `${i}\t${it.outlet}\t${it.title}`).join("\n");
    const res = await client.messages.create({
      model: SITE.matcherModel,
      max_tokens: 1500,
      system:
        "You are a news desk editor. You receive numbered headlines from many outlets in English and Spanish. Group the ones that report the SAME specific news event (same who, what, when). Being about the same broad topic is not enough. Output strict JSON only.",
      messages: [
        {
          role: "user",
          content: `Section: ${sectionLabel}\n\n${list}\n\nReturn ONLY raw JSON: {"groups": [[index, index, ...], ...]}. Include only groups with 2 or more headlines from at least 2 different outlets. Order groups by how many outlets cover the event, most first. No markdown fences.`,
        },
      ],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = JSON.parse(text.replace(/```json|```/g, "").trim().match(/\{[\s\S]*\}/)[0]);
    const groups = (json.groups || [])
      .map((g) => [...new Set(g)].map((i) => recent[i]).filter(Boolean))
      .filter((g) => g.length >= 2);
    return groups.map(finalize);
  } catch (e) {
    console.warn(`matcher failed for ${sectionLabel}, using keyword fallback (${e.message})`);
    return keywordCluster(recent).map(finalize);
  }
}

function finalize(items) {
  const outlets = new Set(items.map((i) => i.outlet));
  const lines = new Set(items.map((i) => i.line));
  const newest = Math.max(...items.map((i) => i.ts));
  return {
    key: items.map((i) => i.id).sort().join("+"),
    items: [...items].sort((a, b) => b.ts - a.ts),
    outlets: [...outlets],
    lines: [...lines],
    newest,
    score: outlets.size * 10 + lines.size * 5 + (newest - (Date.now() - SITE.windowHours * 3600e3)) / 3600e3,
  };
}

// Decide what qualifies. Returns { picks, held }.
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

// ---- fallback: crude keyword overlap, only used if the matcher call fails ----
const STOP = new Set(("a an the of to in on for and or with by from at as is are was were be been this that these those it its into over after before " +
  "el la los las un una unos unas de del y o en por para con sin sobre es son fue como que se su sus al lo le les más ya tras").split(" "));
const tokens = (t) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
function keywordCluster(items, threshold = 0.25) {
  const clusters = [];
  for (const it of items) {
    const tok = tokens(it.title);
    let best = null, bestScore = 0;
    for (const c of clusters) {
      let inter = 0; for (const t of tok) if (c.tok.has(t)) inter++;
      const s = inter / (tok.size + c.tok.size - inter || 1);
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best && bestScore >= threshold) { best.items.push(it); for (const t of tok) best.tok.add(t); }
    else clusters.push({ tok, items: [it] });
  }
  return clusters.map((c) => c.items).filter((g) => g.length >= 2);
}
