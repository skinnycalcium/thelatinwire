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
  { id: "politics", label: "Politics", writer: "vega", requireTwoLines: true, storiesPerSection: 8, frontCount: 8,
    audience: "The Politics desk covers US national politics broadly (Congress, the White House, federal courts, elections and campaigns, governors and state politics, immigration, foreign policy) and the politics of Latin America and the Caribbean. Any substantive political news story qualifies; celebrity gossip and sports do not." },
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

// The columnist takes the top politics story of each edition; everything else goes to the beat writer.
export function assignWriter(section, rank) {
  return section.id === "politics" && rank === 0 ? "santamaria" : section.writer;
}

export const AUDIENCE =
  "This desk covers news for Hispanics and Latinos in the United States and news from Latin America and the Caribbean. A story qualifies only if its main subject is a Latino person, community, business or institution, a Latin American or Caribbean country, US policy that specifically affects Latinos or Latin America (immigration, trade with the region, relations with a Latin American government), or Latin music, film, food, sport or culture. General US or world news that merely mentions the region in passing does not qualify.";

export const audienceFor = (section) => section.audience || AUDIENCE;
