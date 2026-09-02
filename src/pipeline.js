import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { SECTIONS, SITE, assignWriter } from "./config.js";
import { render } from "./render.js";

const DATA = new URL("../data/", import.meta.url).pathname;
mkdirSync(DATA, { recursive: true });
const load = (f, d) => (existsSync(DATA + f) ? JSON.parse(readFileSync(DATA + f, "utf8")) : d);
const save = (f, v) => writeFileSync(DATA + f, JSON.stringify(v, null, 2));

const args = new Set(process.argv.slice(2));
const now = Date.now();
const archive = load("archive.json", []);

if (args.has("--render-only")) {
  console.log(`rendered ${render(archive, now)} stories`);
  process.exit(0);
}

const { ingest } = await import("./ingest.js");
const { clusterSection, select } = await import("./cluster.js");
const { factSheet, writeArticle, translateArticle } = await import("./desk.js");

console.log(`[${new Date(now).toISOString()}] edition start`);
const items = await ingest();
console.log(`ingested ${items.length} items`);

const published = new Set(archive.flatMap((s) => s.sources.map((x) => x.url)));
const seen = new Set(load("seen.json", []));
const held = [];
const plan = [];

await Promise.all(
  SECTIONS.map(async (sec) => {
    const secItems = items.filter((i) => i.section === sec.id);
    const newCount = secItems.filter((i) => !seen.has(i.id)).length;
    if (newCount < 2) { console.log(`${sec.label}: ${secItems.length} items, ${newCount} new, skipped matching`); return; }
    const clusters = await clusterSection(secItems, sec.label);
    const { picks, held: h } = select(clusters, sec.id, published);
    held.push(...h.map((c) => ({ section: sec.id, outlets: c.outlets, lines: c.lines, titles: c.items.map((i) => i.title), links: c.items.map((i) => i.link) })));
    picks.forEach((c, rank) => plan.push({ sec, cluster: c, rank }));
    console.log(`${sec.label}: ${secItems.length} items, ${newCount} new, ${clusters.length} matched stories, ${picks.length} picked, ${h.length} held`);
  })
);
save("seen.json", items.map((i) => i.id));

save("held.json", { at: now, held });
if (args.has("--ingest-only")) {
  save("plan.json", plan.map((p) => ({ section: p.sec.id, rank: p.rank, outlets: p.cluster.outlets, titles: p.cluster.items.map((i) => i.title) })));
  process.exit(0);
}
if (!plan.length) {
  console.log("nothing new cleared the desk; site left as is");
  console.log(`rendered ${render(archive, now)} stories to public/`);
  process.exit(0);
}

const fresh = [];
await Promise.all(
  plan.map(async ({ sec, cluster, rank }) => {
    try {
      const sheet = await factSheet(cluster, sec);
      if (!sheet.coherent) { console.warn(`${sec.label} #${rank}: cluster not coherent, skipped`); return; }
      if (sheet.relevant === false) { console.warn(`${sec.label} #${rank}: not a Latin story, skipped`); return; }
      const writer = assignWriter(sec, rank);
      const art = await writeArticle(sheet, writer, sec);
      const es = await translateArticle(sheet, art).catch((e) => { console.warn(`translation failed: ${e.message}`); return null; });
      fresh.push({
        es,
        id: `${new Date(now).toISOString().slice(0, 10)}-${cluster.key.slice(0, 12)}`,
        section: sec.id,
        rank,
        writer,
        headline: sheet.headline,
        dek: art.dek,
        body: art.body,
        facts: sheet.facts,
        perspectives: sheet.perspectives || [],
        location: sheet.location,
        when: sheet.when,
        sources: cluster.items.slice(0, 4).map((i) => ({ outlet: i.outlet, url: i.link, line: i.line })),
        published: now,
      });
    } catch (e) {
      console.warn(`${sec.label} #${rank} failed: ${e.message}`);
    }
  })
);

const merged = [...fresh, ...archive].filter((s) => s.published > now - 30 * 86400e3);
save("archive.json", merged);
save(`edition-${new Date(now).toISOString().replace(/[:.]/g, "-")}.json`, fresh);
console.log(`wrote ${fresh.length} new stories, ${held.length} held for balance review`);
console.log(`rendered ${render(merged, now)} stories to public/`);
