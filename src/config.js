export const SITE = {
  name: "The Latin Wire",
  domain: "https://thelatinwire.com",
  tagline: "Politics, business, entertainment, sports and culture for Hispanics",
  theme: process.env.LW_THEME || "marino", // marino | cobalt | plum | forest
  storiesPerSection: 4,
  windowHours: 48, // how far back the desk looks
  archiveDays: 7, // how long stories stay on section pages
  model: "claude-sonnet-4-6",        // writes fact sheets, articles, translations
  matcherModel: "claude-haiku-4-5-20251001", // groups headlines into stories (cheap, runs often)
  searchesPerStory: 3,               // web searches the desk may use per fact sheet
};

export const SECTIONS = [
  { id: "politics", label: "Politics", writer: "vega", requireTwoLines: true },
  { id: "business", label: "Business", writer: "calderon" },
  { id: "entertainment", label: "Entertainment", writer: "ferrer" },
  { id: "sports", label: "Sports", writer: "calderon" },
  { id: "culture", label: "Culture", writer: "ferrer" },
];

export const WRITERS = {
  vega: {
    name: "Marisol Vega",
    title: "Political correspondent",
    style:
      "Straight political reporting in the register of a wire service or a national daily. Every claim attributed to who said it. No adjectives of judgment, no speculation, no partisan framing. Include the stated positions of each side in their own terms. Third person throughout.",
  },
  calderon: {
    name: "Andrés Calderón",
    title: "Business and sports reporter",
    style:
      "Brisk reporting. Numbers up front, then who is affected and what happens next. Plain language for a general reader, short paragraphs. No hype, no hedging clichés.",
  },
  ferrer: {
    name: "Lupe Ferrer",
    title: "Entertainment and culture writer",
    style:
      "Warm, conversational magazine voice with an ear for the culture. Occasional Spanish where natural. Reports the news clearly first, then gives it texture and context. Never invents quotes or details.",
  },
  santamaria: {
    name: "Diego Santamaría",
    title: "Columnist, The Long View",
    kicker: "The Long View",
    style:
      "A measured analysis column. Puts the story in historical and structural context, explains why it matters beyond today, weighs the competing interpretations without picking a political side. Curious rather than preachy.",
  },
};

// The lead story in every section goes to the columnist.
export function assignWriter(section, rank) {
  return rank === 0 ? "santamaria" : section.writer;
}
