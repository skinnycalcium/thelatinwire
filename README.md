# The Latin Wire

Automated Latin news publication. Every 15 minutes the desk reads dozens of outlets, keeps only stories confirmed by more than one, writes a verified fact sheet, hands it to a staff writer by beat, and publishes a static site.

## How an edition runs

1. **Ingest** (`src/ingest.js`): pulls every feed in `feeds.json`, keeps items from the last 48 hours, fetches article text where the site allows it.
2. **Match** (`src/cluster.js`): a small fast model (Haiku) groups headlines that report the same event, across outlets and across English and Spanish. Runs only for sections with new headlines since the last check. A story qualifies with 2+ distinct outlets. Politics additionally requires 2+ editorial lines (left / center / right / wire, tagged per feed). Political stories that miss that bar go to `data/held.json` instead of publishing.
3. **Fact sheet** (`src/desk.js`): Claude searches the web for the actual coverage (up to 3 searches) and produces attributed facts, a headline, and for politics a "where each side stands" list. If the cluster is actually two unrelated stories it says so and the story is skipped.
4. **Write** (`src/desk.js`): the assigned writer files from the fact sheet only. Lead story in each section goes to the columnist. A translation pass then produces the Spanish version; every story page has an English / Español toggle at the top, and the reader's choice sticks across pages.
5. **Render** (`src/render.js`): front page, five section pages, one page per story, and `rss.xml` into `public/`.

Writers, sections, and the two-line rule live in `src/config.js`.

## Setup

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm run edition        # full run
npm run ingest         # feeds + clustering only, writes data/plan.json and data/held.json
npm run render         # rebuild public/ from data/archive.json without calling Claude
npm run serve          # preview at http://localhost:3000
```

## Deploy

Push to GitHub, add `ANTHROPIC_API_KEY` under Settings > Secrets, enable GitHub Pages with source "GitHub Actions", run the workflow once, then in Settings > Pages enter `thelatinwire.com` as the custom domain (the CNAME file is written automatically). At the registrar: four A records for the root to 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 and a CNAME for `www` to `<username>.github.io`. The workflow in `.github/workflows/edition.yml` runs the desk every 15 minutes. Ingest and clustering are free; Claude is only called for stories that haven't been published yet, so a quiet quarter hour costs nothing. Change the palette with the repository variable `LW_THEME` (marino, cobalt, plum, forest).

## Cost

Each new story is 3 Sonnet calls (fact sheet with up to 3 web searches, article, Spanish translation) plus a share of the Haiku matching call, a couple of cents on Sonnet. At 15-minute checks the desk publishes maybe 30 to 60 new stories a day, so expect roughly $20 to $40 a month plus GitHub Actions minutes (96 runs a day, about 1 minute each, which exceeds the free tier on a private repo; a public repo is free).

## Things to watch

- Feeds break silently. Run `npm run ingest` weekly and check the per-outlet counts in the log.
- The held queue tells you where political coverage is one-sided. Add outlets from the missing line rather than loosening the rule.
- Titles cluster on words, so a big story with wildly different headlines across languages can split into two clusters. Lowering the threshold in `clusterSection` merges more aggressively; the coherence check catches over-merging.
- No images yet. Simplest path is Open Graph images from the source articles with attribution; that's the next feature.
