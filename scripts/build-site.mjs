// Builds drzahirhasan.com from catalog/catalog.json.
//
//   node scripts/build-site.mjs
//
// Writes: index.html, fiction.html, childrens-books.html, political-science.html,
// education.html, about.html, contact.html, books/<slug>.html, sitemap.xml.
// Hand-written pages (apps, the two series pages, the games) keep their content;
// only their header and footer are refreshed.
//
// The site is built on the same construction as mapleandpinepress.com — same
// header, hero, cards, bands and footer — with the author's own green accent.
// The catalogue is shared with the press; a GitHub Action copies it here.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://drzahirhasan.com";
const cat = JSON.parse(readFileSync(join(ROOT, "catalog/catalog.json"), "utf8"));
const BOOKS = cat.books.filter((b) => b.authorSite?.show !== false);
const PHOTO = "images/author/zahir-hasan.jpg";
const STUDIO = "images/author/zahir-hasan-studio.jpg";

// ─── Sections as the author site presents them ────────────────────────────
const SECTIONS = {
  fiction: {
    page: "fiction.html",
    nav: "Fiction",
    title: "Fantasy & Science Fiction",
    pill: "Fantasy & Science Fiction",
    intro:
      "Epic fantasy, dark fantasy and speculative fiction: dragons and kingdoms, courts and conspiracies, machines that remember and cities that bargain with the dead. Several are the openings of longer series.",
    short: "Dragons, courts and conspiracies, machines that remember.",
  },
  kids: {
    page: "childrens-books.html",
    nav: "Children's",
    title: "Children's Books",
    pill: "Children's Books",
    intro:
      "Gentle, illustrated stories about curiosity, persistence and quiet courage, workbooks for first readers, and two middle-grade fantasy series.",
    short: "Illustrated stories, first workbooks, two middle-grade series.",
  },
  policy: {
    page: "political-science.html",
    nav: "Politics",
    title: "Politics, Law & International Affairs",
    pill: "Politics & International Affairs",
    intro:
      "Power, sovereignty, conflict and the struggle over truth, from Japan's strategic turn to the machinery of expulsion in the United States. Fully referenced, written to be read by anyone.",
    short: "Power, sovereignty, conflict, and the struggle over truth.",
  },
  practice: {
    page: "education.html",
    nav: "Education",
    title: "Education & Practical Guides",
    pill: "Education & Practice",
    intro:
      "Handbooks drawn from a career in the classroom: teaching and learning in the age of AI, academic English, project-based learning, and practical guides to law and work in everyday life.",
    short: "Teaching in the age of AI, academic English, everyday law.",
  },
};
const ORDER = ["fiction", "kids", "policy", "practice"];

// ─── Helpers ──────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (s) => esc(s).replace(/'/g, "&#39;");
// Decode HTML entities so values re-read from already-built pages (legacy reshell)
// are not escaped a second time. Loops to fully unwind layers accumulated by
// earlier double-escaping (e.g. "&amp;amp;amp;" -> "&"); &amp; is decoded last.
const decodeEntities = (s) => {
  let out = String(s ?? ""), prev;
  do {
    prev = out;
    out = out.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  } while (out !== prev);
  return out;
};
const bookUrl = (b) => `books/${b.slug}.html`;
const thumb = (b) => `images/covers/thumbs/${b.slug}.jpg`;
const full = (b) => `images/covers/${b.slug}.jpg`;
const sec = (b) => b.authorSite?.section || b.list;
const amazon = (asin) => `https://www.amazon.com/dp/${asin}`;
const amazonJp = (asin) => `https://www.amazon.co.jp/dp/${asin}`;
const bySection = (key) => BOOKS.filter((b) => sec(b) === key);
const seriesLabel = (b) => (b.series ? `${b.series.name} · Book ${b.series.order}` : null);
const P = (depth) => (depth ? "../" : "");

function shellTop({ active, depth = 0, title, description, url, image, jsonld, type = "website" }) {
  const p = P(depth);
  const items = [
    ["index.html", "Home"],
    ...ORDER.map((k) => [SECTIONS[k].page, SECTIONS[k].nav.replace("&", "&amp;")]),
    ["apps.html", "Apps"],
    ["about.html", "About"],
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${attr(description)}">
  <meta name="author" content="Dr. Zahir Hasan">
  <link rel="canonical" href="${SITE}/${url}">
  <link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="Dr. Zahir Hasan">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:url" content="${SITE}/${url}">
  ${image ? `<meta property="og:image" content="${SITE}/${image}">\n  <meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`}
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
  <link rel="stylesheet" href="${p}css/site.css">
  <!-- Cloudflare Web Analytics (free, no cookies) --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "995d9b4d33ac468bb84cb0bc4769b0a8"}'></script>
</head>
<body>
<div class="site">
  <div class="topbar"><b>New:</b> <i>A Manufactured War</i>, updated through August 2026 &middot; the fantasy and science fiction now has <a href="${p}fiction.html" style="color:#fff">its own page</a></div>
  <header class="site-header">
    <div class="hwrap">
      <a href="${p}index.html" class="wordmark" aria-label="Dr. Zahir Hasan home">
        <span class="wm-text">
          <span class="wm1">DR. ZAHIR <span class="wm-sur">HASAN</span></span>
          <span class="wm2">Author &middot; Tokyo</span>
        </span>
      </a>
      <nav aria-label="Main">
${items.map(([href, label]) => `        <a href="${p}${href}"${active === href ? ' class="active"' : ""}>${label}</a>`).join("\n")}
        <a href="${p}contact.html" class="cta">Newsletter</a>
      </nav>
    </div>
  </header>
  <main>`;
}

function shellBottom(depth = 0, kit = false) {
  const p = P(depth);
  return `  </main>
  <footer class="site-footer">
    <div class="wrap">
      <div class="fgrid">
        <div>
          <div class="fmark">DR. ZAHIR HASAN</div>
          <p style="max-width:300px">Fantasy and science fiction, children's books, and works on politics, law and education. Written in Tokyo, published by Maple &amp; Pine Press.</p>
        </div>
        <div>
          <h5>Books</h5>
${ORDER.map((k) => `          <a href="${p}${SECTIONS[k].page}">${SECTIONS[k].nav.replace("&", "&amp;")}</a>`).join("\n")}
        </div>
        <div>
          <h5>More</h5>
          <a href="${p}apps.html">Apps &amp; Games</a>
          <a href="${p}about.html">About</a>
          <a href="${p}contact.html">Contact &amp; Newsletter</a>
          <a href="https://mapleandpinepress.com" rel="noopener">Maple &amp; Pine Press</a>
        </div>
        <div>
          <h5>Elsewhere</h5>
          <a href="https://www.amazon.com/Dr-Zahir-Hasan/e/B0H97YZ9GT" rel="noopener">Amazon author page</a>
          <a href="https://movementforaction.org" rel="noopener">Movement for Action</a>
          <a href="https://zachstera3.itch.io" rel="noopener">Games on itch.io</a>
        </div>
      </div>
      <div class="fbottom">
        <div>&copy; ${new Date().getFullYear()} Dr. Zahir Hasan. All rights reserved.</div>
        <div>${BOOKS.length} books and counting &middot; Tokyo, Japan</div>
      </div>
    </div>
  </footer>
</div>
${kit ? `<script src="https://f.convertkit.com/ckjs/ck.5.js" async></script>\n` : ""}</body>
</html>`;
}

function card(b, depth = 0) {
  const p = P(depth);
  const s = SECTIONS[sec(b)];
  const fit = b.coverFit === "contain" ? " contain" : "";
  const line = seriesLabel(b) && b.series.name !== b.title ? seriesLabel(b) : b.subtitle || "";
  return `<a href="${p}${bookUrl(b)}" class="card">
  <div class="cover${fit}"><img src="${p}${thumb(b)}" alt="${attr(b.title)} cover" loading="lazy"></div>
  <span class="pill ${b.list}">${esc(s.pill)}</span>
  <h3>${esc(b.title)}</h3>
  <div class="meta">${esc(line)}${b.status === "forthcoming" ? " &middot; Forthcoming" : ""}</div>
</a>`;
}
const grid = (books, depth = 0) => `<div class="grid">\n${books.map((b) => card(b, depth)).join("\n")}\n</div>`;

const newsletterBand = (depth = 0) => `<div class="newsl" id="newsletter">
    <div class="wrap">
      <h2>Hear About the Next Book First</h2>
      <p>One short email when a new title is out: fantasy, a children's story, or a new look at the politics of the day. No noise in between.</p>
      <form class="nlform" action="https://app.kit.com/forms/10080580/subscriptions" method="post" data-sv-form="10080580" data-uid="09d504e103" data-format="inline" data-version="5" data-options='{"settings":{"after":{"action":"message","success_message":"Thank you. Please check your inbox for a confirmation email."},"analytics":{"google":null,"fathom":null,"facebook":null,"segment":null,"pinterest":null,"sparkloop":null,"googletagmanager":null},"modal":{"trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"powered_by":{"show":false},"recaptcha":{"enabled":false},"return_visitor":{"action":"show","custom_content":""},"slide_in":{"display_in":"bottom_right","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"sticky_bar":{"display_in":"top","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15}},"version":"5"}'>
        <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert" style="display:none;"></ul>
        <div data-element="fields" data-stacked="false" style="display:contents">
          <input class="formkit-input" name="email_address" type="email" placeholder="Your email address" aria-label="Email address" required>
          <button class="nlbtn formkit-submit" data-element="submit" type="submit"><span>Subscribe</span></button>
        </div>
      </form>
      <div class="nlnote">We never share your address. Unsubscribe anytime.</div>
    </div>
  </div>`;

// ─── Home ─────────────────────────────────────────────────────────────────
function homePage() {
  const lead = BOOKS.find((b) => b.slug === "a-manufactured-war");
  const counts = Object.fromEntries(ORDER.map((k) => [k, bySection(k).length]));
  const shelf = (k, n) => {
    const books = bySection(k);
    return [...books.filter((b) => b.authorSite?.featured), ...books.filter((b) => !b.authorSite?.featured)].slice(0, n);
  };
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE}/#author`,
    name: "Dr. Zahir Hasan",
    url: SITE,
    image: `${SITE}/${PHOTO}`,
    jobTitle: "Author",
    description: "Author of fantasy and science fiction, children's books, and works on politics, law and education. Based in Tokyo; published by Maple & Pine Press.",
    knowsAbout: ["Fantasy Fiction", "Science Fiction", "Children's Literature", "Political Science", "International Relations", "Law", "Education"],
  };
  return `${shellTop({
    active: "index.html",
    title: "Dr. Zahir Hasan — Author of fantasy, children's books and political writing",
    description: `Official site of Dr. Zahir Hasan: ${counts.fiction} fantasy and science-fiction titles, ${counts.kids} children's books, and ${counts.policy + counts.practice} works on politics, law and education. Written in Tokyo.`,
    url: "",
    image: PHOTO,
    jsonld,
  })}
    <div class="hero">
      <div class="wrap">
        <div>
          <div class="kicker">Author &middot; Tokyo</div>
          <h1>Stories that shape how we see the world</h1>
          <p class="sub">Fantasy and science fiction for grown-ups. Illustrated books for children. Clear-eyed writing on politics, law and education.</p>
          <p class="blurb">${BOOKS.length} books across four lists, all published by Maple &amp; Pine Press, the small independent press he founded in Tokyo. Start with the fiction, or with whatever the news has made you curious about.</p>
          <div class="btnrow">
            <a href="fiction.html" class="hp-btn primary">Fantasy &amp; Sci-Fi</a>
            <a href="childrens-books.html" class="hp-btn ghost">Children's Books</a>
            <a href="political-science.html" class="hp-btn ghost">Politics &amp; Law</a>
          </div>
        </div>
        <div class="hero-photo">
          <div class="badge">${BOOKS.length} books</div>
          <img src="${PHOTO}" alt="Dr. Zahir Hasan" width="1040" height="1300">
        </div>
      </div>
    </div>

    <section class="band">
      <div class="wrap">
        <div class="sechead">
          <h2>New &amp; Notable</h2>
          <div class="rule"></div>
          <a href="${bookUrl(lead)}">About ${esc(lead.title)} &rarr;</a>
        </div>
        <div class="grid">
          ${BOOKS.filter((b) => b.press?.featured)
            .sort((a, b) => (a.press.featuredOrder ?? 99) - (b.press.featuredOrder ?? 99))
            .map((b) => card(b))
            .join("\n          ")}
        </div>
      </div>
    </section>

    <div class="strip">
      <div class="wrap">
        <div><span class="num">${counts.fiction}</span><h3>Fantasy &amp; Science Fiction</h3><p>${esc(SECTIONS.fiction.short)}</p></div>
        <div><span class="num">${counts.kids}</span><h3>Children's Books</h3><p>${esc(SECTIONS.kids.short)}</p></div>
        <div><span class="num">${counts.policy + counts.practice}</span><h3>Politics, Law &amp; Education</h3><p>${esc(SECTIONS.policy.short)}</p></div>
      </div>
    </div>

${ORDER.map(
  (k) => `    <section class="band">
      <div class="wrap">
        <div class="sechead">
          <h2>${esc(SECTIONS[k].title)}</h2>
          <div class="rule"></div>
          <a href="${SECTIONS[k].page}">All ${counts[k]} titles &rarr;</a>
        </div>
        ${grid(shelf(k, 4))}
      </div>
    </section>`,
).join("\n\n")}

    <section class="band" style="padding-top:0">
      <div class="wrap">
        <div class="sechead">
          <h2>Apps &amp; Games</h2>
          <div class="rule"></div>
          <a href="apps.html">See all &rarr;</a>
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:24px">
          ${[["6782443465", "Rex Rumble"], ["6784346438", "Strike Zone"], ["6784266952", "DinoQuest Puzzles"], ["6783693646", "Bug Safari Kids"], ["6782613065", "iBT Exam Prep"]]
            .map(([id, name]) => `<a href="apps.html" class="card" style="text-align:center"><img src="images/apps/${id}.jpg" alt="${name} icon" loading="lazy" style="width:96px;height:96px;border-radius:22px;margin:0 auto 12px;box-shadow:0 6px 16px rgba(28,24,18,.2)"><h3 style="font-size:16px">${name}</h3></a>`)
            .join("\n          ")}
        </div>
      </div>
    </section>

    ${newsletterBand()}
${shellBottom(0, true)}`;
}

// ─── Section pages ────────────────────────────────────────────────────────
function sectionPage(key) {
  const s = SECTIONS[key];
  const books = bySection(key);
  let body;
  if (key === "fiction" || key === "kids") {
    const seriesNames = [...new Set(books.filter((b) => b.series).map((b) => b.series.name))].filter(
      (name) => books.filter((b) => b.series?.name === name).length > 1,
    );
    const blocks = seriesNames.map((name) => {
      const inSeries = books.filter((b) => b.series?.name === name).sort((a, b) => a.series.order - b.series.order);
      const page = name === "The Whispering Realms" ? "whispering-realms.html" : name === "The Elk Kingdom Chronicles" ? "elk-kingdom.html" : null;
      return `<div class="series">
          <div class="sechead" style="margin-bottom:22px"><h2 style="font-size:24px">${esc(name)}</h2><div class="rule"></div>${page ? `<a href="${page}">About the series &rarr;</a>` : `<a href="${bookUrl(inSeries[0])}">Start with Book 1 &rarr;</a>`}</div>
          ${grid(inSeries)}
        </div>`;
    });
    const rest = books.filter((b) => !b.series || !seriesNames.includes(b.series.name));
    blocks.push(`<div class="series">
          <div class="sechead" style="margin-bottom:22px"><h2 style="font-size:24px">${key === "fiction" ? "Novels, novellas and series openers" : "Picture books, activity books and stories"}</h2><div class="rule"></div></div>
          ${grid(rest)}
        </div>`);
    body = blocks.join("\n        ");
  } else {
    body = grid(books);
  }
  return `${shellTop({
    active: s.page,
    title: `${s.title} — Dr. Zahir Hasan`,
    description: s.intro,
    url: s.page,
    image: thumb(books[0]),
  })}
    <div class="pagehead">
      <div class="wrap">
        <div class="kicker">${books.length} titles</div>
        <h1>${esc(s.title)}</h1>
        <p>${esc(s.intro)}</p>
      </div>
    </div>
    <section class="band" style="padding-top:48px">
      <div class="wrap">
        ${body}
      </div>
    </section>
    ${newsletterBand()}
${shellBottom(0, true)}`;
}

// ─── Book pages ───────────────────────────────────────────────────────────
function bookPage(b) {
  const s = SECTIONS[sec(b)];
  const paras = (b.description?.length ? b.description : [b.authorSite?.blurb || ""]).filter(Boolean);
  const inSeries = b.series ? BOOKS.filter((x) => x.series?.name === b.series.name && x.slug !== b.slug) : [];
  const more = bySection(sec(b)).filter((x) => x.slug !== b.slug && !inSeries.includes(x)).slice(0, 4);
  const buy =
    b.status === "forthcoming" || !b.asins.length
      ? `<p class="soonnote">Forthcoming. Join the newsletter below to hear when it is out.</p>`
      : `<div class="buyrow">
              <a class="buylink" href="${amazon(b.asins[0])}" rel="noopener">Buy on Amazon</a>
              <a class="buylink alt" href="${amazonJp(b.asins[0])}" rel="noopener">Amazon Japan</a>${b.asins[1] ? `\n              <a class="buylink alt" href="${amazon(b.asins[1])}" rel="noopener">Paperback</a>` : ""}
            </div>
            <p class="buynote">Ebook${b.asins[1] ? " and paperback" : ""} &middot; Maple &amp; Pine Press</p>`;
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: b.title,
    ...(b.subtitle ? { alternateName: `${b.title}: ${b.subtitle}` } : {}),
    author: { "@type": "Person", name: "Dr. Zahir Hasan", url: `${SITE}/` },
    publisher: { "@type": "Organization", name: "Maple & Pine Press" },
    image: `${SITE}/${full(b)}`,
    url: `${SITE}/${bookUrl(b)}`,
    inLanguage: "en",
    ...(b.description?.[0] ? { description: b.description[0] } : {}),
    ...(b.series ? { isPartOf: { "@type": "BookSeries", name: b.series.name }, position: b.series.order } : {}),
    workExample: b.asins.map((a, i) => ({
      "@type": "Book",
      bookFormat: i === 0 ? "https://schema.org/EBook" : "https://schema.org/Paperback",
      url: amazon(a),
    })),
  };
  return `${shellTop({
    active: s.page,
    depth: 1,
    type: "book",
    title: `${b.title}${b.subtitle ? `: ${b.subtitle}` : ""} — Dr. Zahir Hasan`,
    description: (b.description?.[0] || b.authorSite?.blurb || b.title).slice(0, 300),
    url: bookUrl(b),
    image: full(b),
    jsonld,
  })}
    <div class="pagehead">
      <div class="wrap">
        <div class="crumbs" style="padding:0 0 14px"><a href="../index.html">Home</a> &rsaquo; <a href="../${s.page}">${esc(s.title)}</a></div>
        <span class="pill ${b.list}">${esc(s.pill)}</span>
        <h1>${esc(b.title)}</h1>
        ${b.subtitle ? `<p class="booksub">${esc(b.subtitle)}</p>` : ""}
      </div>
    </div>
    <div class="wrap bookpage">
      <div class="bookgrid">
        <div class="bookcover"><img src="../${full(b)}" alt="${attr(b.title)} cover"${b.coverFit === "contain" ? ' class="contain"' : ""} width="900"></div>
        <div class="bookmeta">
          <div class="bookdesc">
            ${paras.map((t) => `<p>${esc(t)}</p>`).join("\n            ")}
          </div>
          ${buy}
          <dl>
            <dt>Author</dt><dd>Dr. Zahir Hasan</dd>
            <dt>Publisher</dt><dd>Maple &amp; Pine Press, Tokyo</dd>
            ${b.series ? `<dt>Series</dt><dd>${esc(seriesLabel(b))}</dd>` : ""}
            <dt>List</dt><dd><a href="../${s.page}" style="color:var(--accent)">${esc(s.title)}</a></dd>
          </dl>
          ${
            inSeries.length
              ? `<section class="alsoin"><h2>Also in ${esc(b.series.name)}</h2>${grid(inSeries, 1)}</section>`
              : ""
          }
          <section class="alsoin"><h2>More ${esc(s.title)}</h2>${grid(more, 1)}</section>
        </div>
      </div>
    </div>
${shellBottom(1)}`;
}

// ─── About & Contact ──────────────────────────────────────────────────────
function aboutPage() {
  return `${shellTop({
    active: "about.html",
    title: "About Dr. Zahir Hasan — Author, Tokyo",
    description: "Zahir Hasan is a Canadian academic and author in Tokyo: fantasy and science fiction, children's books, and works on politics, law and education, all published by Maple & Pine Press.",
    url: "about.html",
    image: STUDIO,
  })}
    <div class="pagehead">
      <div class="wrap">
        <div class="kicker">About</div>
        <h1>Dr. Zahir Hasan</h1>
        <p>Novelist, children's author, and a scholar of politics, law and education. Canadian by passport, Tokyo by address.</p>
      </div>
    </div>
    <div class="wrap">
      <div class="about2col">
        <figure class="about-photo" style="margin:0">
          <img src="${STUDIO}" alt="Dr. Zahir Hasan in the Maple &amp; Pine Press studio" width="1600" height="1067">
          <figcaption>In the studio where the Maple &amp; Pine Press podcast is recorded.</figcaption>
        </figure>
        <div>
          <h2>The writing came out of the teaching</h2>
          <p>Zahir Hasan grew up between China, Singapore and Denmark before studying in the United States and Europe. He holds a bachelor's degree in economics and political science, master's degrees in public policy and administration and in law, and a doctorate in education. He teaches at universities in Tokyo, where he has lived and worked for many years.</p>
          <p>The political books began as the explanations he wished his students could find in one place: fully referenced, but written to be read. The children's books began at home. The fantasy and science fiction is the part he would have written first if the day had been longer.</p>
          <p>All of his books are published by <a href="https://mapleandpinepress.com" rel="noopener" style="color:var(--accent)">Maple &amp; Pine Press</a>, the small independent press he founded in Tokyo. The maple is for Canada, the pine for Japan.</p>
          <div class="founder" style="margin-top:28px">
            <h3>Beyond the books</h3>
            <div class="role">Also by Zahir</div>
            <p style="margin-bottom:10px">He founded and leads <a href="https://movementforaction.org" rel="noopener" style="color:var(--accent)">Movement for Action</a>, a Tokyo-based non-profit working on education for children in Asia, Africa and Latin America, with a particular focus on keeping girls in school.</p>
            <p style="margin-bottom:0">He also builds <a href="apps.html" style="color:var(--accent)">apps and browser games</a>: dinosaur battles, a baseball duel, puzzles for small hands, and study tools for learners of English.</p>
          </div>
        </div>
      </div>
      <div class="sechead"><h2>Four kinds of books</h2><div class="rule"></div></div>
      <div class="lists4">
${ORDER.map((k) => `        <a href="${SECTIONS[k].page}"><h3>${esc(SECTIONS[k].title)}</h3><p>${esc(SECTIONS[k].short)}</p></a>`).join("\n")}
      </div>
    </div>
    ${newsletterBand()}
${shellBottom(0, true)}`;
}

function contactPage() {
  return `${shellTop({
    active: "contact.html",
    title: "Contact & Newsletter — Dr. Zahir Hasan",
    description: "Get in touch with Dr. Zahir Hasan for talks, interviews or review copies, or join the reader list to hear about new books first.",
    url: "contact.html",
  })}
    <div class="pagehead">
      <div class="wrap">
        <div class="kicker">Contact</div>
        <h1>Get in touch</h1>
        <p>Questions about the books, an interview, a talk, a review copy, or a note about the stories: all welcome. He answers his own email.</p>
      </div>
    </div>
    <div class="wrap">
      <div class="subgrid">
        <div class="contactcard">
          <h3>Email</h3>
          <p>The best way to reach him. He aims to reply within a few days.</p>
          <a class="buylink" href="mailto:zachthasan@gmail.com">zachthasan@gmail.com</a>
          <h3 style="margin-top:34px">Publisher</h3>
          <p>For rights, bulk orders and bookshop enquiries, write to the press.</p>
          <a class="buylink alt" href="https://mapleandpinepress.com" rel="noopener">Maple &amp; Pine Press</a>
        </div>
        <div class="contactcard">
          <h3>Join the reader list</h3>
          <p>One short email when a new title is out. Nothing in between.</p>
          <form class="nlform left" action="https://app.kit.com/forms/10080580/subscriptions" method="post" data-sv-form="10080580" data-uid="09d504e103" data-format="inline" data-version="5" data-options='{"settings":{"after":{"action":"message","success_message":"Thank you. Please check your inbox for a confirmation email."},"analytics":{"google":null,"fathom":null,"facebook":null,"segment":null,"pinterest":null,"sparkloop":null,"googletagmanager":null},"modal":{"trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"powered_by":{"show":false},"recaptcha":{"enabled":false},"return_visitor":{"action":"show","custom_content":""},"slide_in":{"display_in":"bottom_right","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15},"sticky_bar":{"display_in":"top","trigger":"timer","scroll_percentage":null,"timer":5,"devices":"all","show_once_every":15}},"version":"5"}'>
            <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert" style="display:none;margin-left:0"></ul>
            <div data-element="fields" data-stacked="false" style="display:contents">
              <input class="formkit-input" name="email_address" type="email" placeholder="Your email address" aria-label="Email address" required>
              <button class="nlbtn formkit-submit" data-element="submit" type="submit"><span>Subscribe</span></button>
            </div>
          </form>
          <div class="nlnote" style="text-align:left">We never share your address. Unsubscribe anytime.</div>
        </div>
      </div>
    </div>
${shellBottom(0, true)}`;
}

// ─── Legacy hand-written pages: new shell around the old content ──────────
const LEGACY = { "apps.html": "apps.html", "whispering-realms.html": SECTIONS.kids.page, "elk-kingdom.html": SECTIONS.kids.page };
function refreshLegacy() {
  for (const [page, active] of Object.entries(LEGACY)) {
    const path = join(ROOT, page);
    if (!existsSync(path)) continue;
    const html = readFileSync(path, "utf8");
    const title = decodeEntities((html.match(/<title>([^<]*)<\/title>/) || [, page])[1]);
    const desc = decodeEntities((html.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1]);
    const mainMatch = html.match(/<main>([\s\S]*?)<\/main>/);
    if (!mainMatch) continue;
    // keep the page's own stylesheet for its inner content, load the shared one after it
    const out = `${shellTop({ active, title, description: desc, url: page }).replace(
      '<link rel="stylesheet" href="css/site.css">',
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="css/styles.css">\n  <link rel="stylesheet" href="css/site.css">',
    )}
    <div class="legacy-main">${mainMatch[1]}</div>
${shellBottom(0).replace("</body>", '<script src="js/main.js"></script>\n</body>')}`;
    writeFileSync(path, out);
  }
}

// ─── Sitemap ──────────────────────────────────────────────────────────────
function sitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [["", "1.0"], ...ORDER.map((k) => [SECTIONS[k].page, "0.9"]), ["apps.html", "0.7"], ["about.html", "0.6"], ["contact.html", "0.5"], ["whispering-realms.html", "0.6"], ["elk-kingdom.html", "0.6"], ...BOOKS.map((b) => [bookUrl(b), "0.8"])];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr]) => `  <url><loc>${SITE}/${u}</loc><lastmod>${today}</lastmod><priority>${pr}</priority></url>`).join("\n")}\n</urlset>\n`;
}

// ─── Write everything ─────────────────────────────────────────────────────
mkdirSync(join(ROOT, "books"), { recursive: true });
writeFileSync(join(ROOT, "index.html"), homePage());
for (const k of ORDER) writeFileSync(join(ROOT, SECTIONS[k].page), sectionPage(k));
for (const b of BOOKS) writeFileSync(join(ROOT, bookUrl(b)), bookPage(b));
writeFileSync(join(ROOT, "about.html"), aboutPage());
writeFileSync(join(ROOT, "contact.html"), contactPage());
writeFileSync(join(ROOT, "sitemap.xml"), sitemap());
refreshLegacy();
console.log(`built: home, ${ORDER.length} list pages, ${BOOKS.length} book pages, about, contact, sitemap, ${Object.keys(LEGACY).length} legacy pages reshelled`);
