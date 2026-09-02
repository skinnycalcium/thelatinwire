import Anthropic from "@anthropic-ai/sdk";
import { SITE, WRITERS, audienceFor } from "./config.js";

const client = new Anthropic();

async function ask(system, user, { maxTokens = 1400, search = false } = {}) {
  const req = { model: SITE.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] };
  if (search) req.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: SITE.searchesPerStory }];
  let res;
  try { res = await client.messages.create(req); }
  catch (e) {
    if (!search) throw e;
    console.warn(`web search unavailable, writing from headlines only (${String(e.message).slice(0, 120)})`);
    delete req.tools;
    res = await client.messages.create(req);
  }
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  try { return extractJSON(text); }
  catch (e) {
    // One repair pass: hand the broken output back and ask for valid JSON only.
    const fix = await client.messages.create({
      model: SITE.model, max_tokens: maxTokens,
      system: "You repair malformed JSON. Return the same content as valid JSON only. Escape quotes inside strings. No prose, no fences.",
      messages: [{ role: "user", content: text.slice(0, 12000) }],
    });
    return extractJSON(fix.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  }
}

function extractJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON in model output");
  return JSON.parse(clean.slice(start, end + 1));
}

// Stage 1: verified fact sheet. The desk reads the actual coverage via web search,
// since RSS links (especially Google News) rarely give us article text.
export async function factSheet(cluster, section) {
  const material = cluster.items.slice(0, 5).map((i) =>
    `- ${i.outlet} (${i.line}, ${new Date(i.ts).toISOString().slice(0, 10)}): ${i.title}${i.snippet && i.snippet !== i.title ? " | " + i.snippet : ""}`
  ).join("\n");

  const balance = section.requireTwoLines
    ? "This is a political story. Attribute every claim to who made it. No adjectives of judgment. In perspectives, state each side's position as they themselves state it, one sentence each, without evaluation. If outlets disagree on a fact, say so in the facts."
    : "In perspectives return an empty array.";

  const sheet = await ask(
    `You are the curation desk for ${SITE.name}, an automated publication. ${audienceFor(section)} You are handed headlines from several outlets about one news event. Use web search to read the actual coverage, then produce a strict JSON fact sheet. You never editorialize and you never include a fact you did not find in a source.`,
    `Headlines about this event:\n${material}\n\nSearch for and read the coverage (at most ${SITE.searchesPerStory} searches). ${balance}\n\nIf these headlines are really about different events, set "coherent": false and stop. If the event does not qualify for this publication, set "relevant": false and stop.\n\nRespond with ONLY raw JSON, no markdown fences, no prose before or after:\n{"coherent": true, "relevant": true, "headline": "under 12 words, sentence case, no clickbait", "facts": "6 to 9 sentences of plain attributed facts in English", "perspectives": [{"who": "", "position": ""}], "location": "city or country, under 4 words", "when": "month and day only, e.g. Aug 31"}`,
    { maxTokens: 2000, search: true }
  );
  if (sheet.when) sheet.when = String(sheet.when).split(/[;(,]/)[0].trim().slice(0, 12);
  if (sheet.location) sheet.location = String(sheet.location).split(/[;(,]/)[0].trim().slice(0, 40);
  return sheet;
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
    `Respond with ONLY raw JSON:\n{"headline": "", "dek": "", "body": "keep the \\\\n\\\\n paragraph breaks", "perspectives": [{"who": "", "position": ""}]}\n\nHeadline: ${sheet.headline}\nDek: ${art.dek}\nBody:\n${art.body}${positions}`
  );
}
