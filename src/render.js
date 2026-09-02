import { mkdirSync, writeFileSync, cpSync } from "node:fs";
import { SITE, SECTIONS, WRITERS } from "./config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";
const labelOf = (id) => SECTIONS.find((s) => s.id === id)?.label || id;
const kickerOf = (st) => (WRITERS[st.writer].kicker || labelOf(st.section));

function layout({ title, body, path, now }) {
  return `<!doctype html>
<html lang="en" class="theme-${SITE.theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(SITE.tagline)}">
<link rel="canonical" href="${SITE.domain}${path}">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.name)}" href="/rss.xml">
<link rel="stylesheet" href="/theme.css">
</head>
<body>
<header class="top">
  <div class="topline"><span>${fmtDate(now)}</span></div>
  <a class="mast" href="/">The Latin <em>Wire</em></a>
  <p class="tag">${esc(SITE.tagline)}</p>
  <nav class="nav">
    <a href="/" ${path === "/" ? 'class="on"' : ""}>Front page</a>
    ${SECTIONS.map((s) => `<a href="/${s.id}/" ${path.startsWith("/" + s.id) ? 'class="on"' : ""}>${s.label}</a>`).join("")}
  </nav>
</header>
<main>${body}</main>
<footer class="foot">
  <div>
    <h4>The newsroom</h4>
    ${Object.values(WRITERS).map((w) => `<p><b>${w.name}</b>, ${w.title}</p>`).join("")}
  </div>
  <div><p><a href="/rss.xml">RSS</a></p></div>
</footer>
</body>
</html>`;
}

const teaser = (st, opts = {}) => `
<article class="art ${opts.lead ? "lead" : ""}">
  <p class="kick ${st.writer === "santamaria" ? "analysis" : ""}">${esc(kickerOf(st))}</p>
  <h3 class="hl"><a href="/story/${st.id}/">${esc(st.headline)}</a></h3>
  <p class="dek">${esc(st.dek)}</p>
  <p class="by">By <b>${esc(WRITERS[st.writer].name)}</b>${st.location ? ", " + esc(st.location) : ""}${st.when ? " · " + esc(st.when) : ""}</p>
</article>`;

function storyBody(st, v, lang) {
  const t = (en, es) => (lang === "es" ? es : en);
  return `
  <h1 class="hl">${esc(v.headline)}</h1>
  <p class="dek">${esc(v.dek)}</p>
  <p class="by">${t("By", "Por")} <b>${esc(WRITERS[st.writer].name)}</b>, ${esc(WRITERS[st.writer].title)}${st.location ? " · " + esc(st.location) : ""} · ${fmtDate(st.published)}</p>
  <div class="body">${v.body.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  ${v.perspectives?.length ? `<aside class="persp"><p class="pt">${t("Where each side stands", "Qué dice cada lado")}</p>${v.perspectives.map((p) => `<p><b>${esc(p.who)}:</b> ${esc(p.position)}</p>`).join("")}</aside>` : ""}
  <p class="src"><span>${t("Sources", "Fuentes")}</span>${st.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.outlet)}</a>`).join("")}</p>`;
}

function storyPage(st, now) {
  const en = { headline: st.headline, dek: st.dek, body: st.body, perspectives: st.perspectives };
  const es = st.es && st.es.body ? { ...st.es, perspectives: st.es.perspectives?.length ? st.es.perspectives : st.perspectives } : null;
  const body = `
<article class="story">
  <p class="kick ${st.writer === "santamaria" ? "analysis" : ""}">${esc(kickerOf(st))}</p>
  ${es ? `<div class="lang" role="group" aria-label="Language"><button class="on" data-lang="en">English</button><button data-lang="es">Español</button></div>` : ""}
  <div data-ver="en" lang="en">${storyBody(st, en, "en")}</div>
  ${es ? `<div data-ver="es" lang="es" hidden>${storyBody(st, es, "es")}</div>` : ""}
</article>
${es ? `<script>
(function(){var pick=function(l){document.querySelectorAll('[data-ver]').forEach(function(d){d.hidden=d.dataset.ver!==l});document.querySelectorAll('.lang button').forEach(function(b){b.classList.toggle('on',b.dataset.lang===l)});try{localStorage.setItem('lw-lang',l)}catch(e){}};
document.querySelectorAll('.lang button').forEach(function(b){b.addEventListener('click',function(){pick(b.dataset.lang)})});
try{var s=localStorage.getItem('lw-lang');if(s==='es')pick('es')}catch(e){}})();
</script>` : ""}`;
  return layout({ title: `${st.headline} | ${SITE.name}`, body, path: `/story/${st.id}/`, now });
}

function frontPage(bySection, now) {
  const order = ["politics", "business", "entertainment", "sports", "culture"];
  const all = order.flatMap((id) => bySection[id] || []);
  const lead = all[0];
  const side = order.map((id) => bySection[id]?.[0]).filter((s) => s && s !== lead).slice(0, 3);
  const hero = lead
    ? `<div class="hero"><div class="leadcol">${teaser(lead, { lead: true })}</div><div class="side">${side.map((s) => teaser(s)).join("")}</div></div>`
    : `<p class="note">The desk is reading the wire. Stories appear as soon as two outlets confirm one.</p>`;
  const bands = SECTIONS.map((sec) => {
    const list = (bySection[sec.id] || []).slice(0, sec.frontCount || 4);
    if (!list.length) return "";
    return `<section class="band"><div class="band-head"><h2>${sec.label}</h2><a href="/${sec.id}/">All ${sec.label.toLowerCase()}</a></div><div class="grid">${list.map((s) => teaser(s)).join("")}</div></section>`;
  }).join("");
  return layout({ title: SITE.name, body: hero + bands, path: "/", now });
}

function sectionPage(sec, list, now) {
  const body = `<section class="section-page"><div class="band-head"><h2>${sec.label}</h2></div>${list.length ? list.map((s) => teaser(s)).join("") : `<p class="note">Nothing has cleared the desk for ${sec.label.toLowerCase()} yet.</p>`}</section>`;
  return layout({ title: `${sec.label} | ${SITE.name}`, body, path: `/${sec.id}/`, now });
}

function rss(all, now) {
  const items = all.slice(0, 40).map((st) => `<item><title>${esc(st.headline)}</title><link>${SITE.domain}/story/${st.id}/</link><guid>${SITE.domain}/story/${st.id}/</guid><pubDate>${new Date(st.published).toUTCString()}</pubDate><description>${esc(st.dek)}</description><category>${esc(labelOf(st.section))}</category></item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(SITE.name)}</title><link>${SITE.domain}</link><description>${esc(SITE.tagline)}</description><lastBuildDate>${new Date(now).toUTCString()}</lastBuildDate>${items}</channel></rss>`;
}

export function render(archive, now = Date.now()) {
  const recent = archive
    .filter((s) => s.published > now - SITE.archiveDays * 86400e3)
    .sort((a, b) => b.published - a.published || a.rank - b.rank);
  const bySection = {};
  for (const s of recent) (bySection[s.section] ||= []).push(s);

  const out = new URL("../public/", import.meta.url).pathname;
  mkdirSync(out, { recursive: true });
  cpSync(new URL("../theme.css", import.meta.url).pathname, out + "theme.css");
  writeFileSync(out + "CNAME", SITE.domain.replace(/^https?:\/\//, ""));
  writeFileSync(out + ".nojekyll", "");
  writeFileSync(out + "index.html", frontPage(bySection, now));
  writeFileSync(out + "rss.xml", rss(recent, now));
  for (const sec of SECTIONS) {
    mkdirSync(out + sec.id, { recursive: true });
    writeFileSync(`${out}${sec.id}/index.html`, sectionPage(sec, bySection[sec.id] || [], now));
  }
  for (const st of recent) {
    mkdirSync(`${out}story/${st.id}`, { recursive: true });
    writeFileSync(`${out}story/${st.id}/index.html`, storyPage(st, now));
  }
  return recent.length;
}
