import Anthropic from "@anthropic-ai/sdk";
import { SITE, WRITERS } from "./config.js";
import { fetchText } from "./ingest.js";

const client = new Anthropic();

async function ask(system, user, maxTokens = 1400) {
  const res = await client.messages.create({
    model: SITE.model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return extractJSON(text);
}

function extractJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON in model output");
  return JSON.parse(clean.slice(start, end + 1));
}

// Stage 1: verified fact sheet. The only source of truth the writer sees.
export async function factSheet(cluster, section) {
  const bodies = await Promise.all(cluster.items.slice(0, 4).map((i) => fetchText(i.link)));
  const material = cluster.items.slice(0, 4).map((i, n) =>
    `--- ${i.outlet} (${i.line}) ${new Date(i.ts).toISOString().slice(0, 10)}\nTitle: ${i.title}\nURL: ${i.link}\nSummary: ${i.snippet}\n${bodies[n] ? "Text: " + bodies[n] : ""}`
  ).join("\n\n");

  const balance = section.requireTwoLines
    ? "This is a political story. Attribute every claim to who made it. No adjectives of judgment. In perspectives, state each side's position as they themselves state it, one sentence each, without evaluation. If the sources disagree on a fact, say so in the facts."
    : "In perspectives return an empty array.";

  return ask(
    `You are the curation desk for ${SITE.name}, an automated publication. You read source material from several outlets and produce a strict JSON fact sheet. You never editorialize and you never add facts that are not in the material.`,
    `Source material:\n\n${material}\n\n${balance}\n\nIf the items are actually about different stories, set "coherent": false and stop.\n\nRespond with ONLY raw JSON:\n{"coherent": true, "headline": "under 12 words, sentence case, no clickbait", "facts": "6 to 9 sentences of plain attributed facts in English", "perspectives": [{"who": "", "position": ""}], "location": "city or country", "when": "e.g. Aug 31"}`
  );
}

// Stage 2: the assigned writer files from the fact sheet alone.
export async function writeArticle(sheet, writerId, section) {
  const w = WRITERS[writerId];
  const positions = sheet.perspectives?.length
    ? "\n\nStated positions:\n" + sheet.perspectives.map((p) => `${p.who}: ${p.position}`).join("\n")
    : "";
  return ask(
    `You write articles for ${SITE.name} from a verified fact sheet. Facts never change. Political stories stay non-partisan regardless of writer. Output strict JSON only.`,
    `You are ${w.name}, ${w.title}.\nStyle: ${w.style}\n\nHeadline: ${sheet.headline}\nSection: ${section.label}\nFacts (the only source of truth; do not add, drop, or bend a fact):\n${sheet.facts}${positions}\n\nWrite the piece. Respond with ONLY raw JSON:\n{"dek": "one sentence under 30 words", "body": "3 to 5 short paragraphs separated by \\n\\n, 220 to 320 words"}`
  );
}

// Stage 3: Spanish edition of the same piece. Faithful translation, no rewrite.
export async function translateArticle(sheet, art) {
  const positions = sheet.perspectives?.length ? "\nPerspectives:\n" + sheet.perspectives.map((p) => `${p.who}: ${p.position}`).join("\n") : "";
  return ask(
    `You are the translation desk for ${SITE.name}. Translate into natural Latin American Spanish for a US Hispanic readership. Keep names, numbers, and quotes exact. Keep the writer's tone. No additions. Strict JSON only.`,
    `Respond with ONLY raw JSON:\n{"headline": "", "dek": "", "body": "keep the \\n\\n paragraph breaks", "perspectives": [{"who": "", "position": ""}]}\n\nHeadline: ${sheet.headline}\nDek: ${art.dek}\nBody:\n${art.body}${positions}`
  );
}
