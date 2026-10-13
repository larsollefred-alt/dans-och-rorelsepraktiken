// Builds the static site: content/*.md + src/ → dist/ (plain HTML, CSS and a little JS).
// Run with `npm run build`. Netlify runs it on every push, including edits made in Decap CMS.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { load as parseYaml } from "js-yaml";
import { marked } from "marked";
import sharp from "sharp";

const OUT = "dist";
const IMG_OUT = path.join(OUT, "images/opt");
const WIDTHS = [128, 256, 384, 640, 828, 1080, 1440, 1920];

// ---------- helpers ----------

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "070-323 87 76" → "+46703238776" for tel: links. */
const toTel = (n) => n.replace(/\D/g, "").replace(/^0/, "+46");

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function readMd(file) {
  const raw = await readFile(file, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = m ? parseYaml(m[1]) || {} : {};
  const body = (m ? m[2] : raw).trim();
  return { ...data, body, html: body ? marked.parse(body) : "" };
}

/**
 * Turns an uploaded image ("/images/uploads/x.jpg") into responsive WebP files and returns an <img> tag.
 * Results are cached between builds by file modification time.
 */
const imageCache = new Map();
async function img(src, { alt = "", sizes = "100vw", className = "", eager = false, maxWidth } = {}) {
  if (!src) return "";
  const input = path.join("static", src);
  if (!existsSync(input)) {
    console.warn(`⚠ Bilden saknas: ${src}`);
    return "";
  }
  if (!imageCache.has(src)) {
    const meta = await sharp(input).metadata();
    const name = slugify(path.parse(src).name);
    const limit = Math.min(meta.width, maxWidth ?? Infinity);
    const widths = WIDTHS.filter((w) => w < limit).concat(limit);
    const srcTime = (await stat(input)).mtimeMs;
    for (const w of widths) {
      const out = path.join(IMG_OUT, `${name}-${w}.webp`);
      const fresh = await stat(out).then((s) => s.mtimeMs > srcTime, () => false);
      if (!fresh) await sharp(input).rotate().resize({ width: w }).webp({ quality: 75 }).toFile(out);
    }
    imageCache.set(src, { name, widths, width: meta.width, height: meta.height });
  }
  const { name, widths, width, height } = imageCache.get(src);
  const url = (w) => `/images/opt/${name}-${w}.webp`;
  const srcset = widths.map((w) => `${url(w)} ${w}w`).join(", ");
  const fallback = widths.find((w) => w >= 828) ?? widths.at(-1);
  return `<img src="${url(fallback)}" srcset="${srcset}" sizes="${sizes}" width="${width}" height="${height}" alt="${esc(alt)}"${
    className ? ` class="${className}"` : ""
  }${eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

// ---------- content ----------

const settings = await readMd("content/installningar.md");
const hero = await readMd("content/hero.md");
const about = await readMd("content/om-mig.md");
const knowledge = await readMd("content/mer-kunskap.md");
const contact = await readMd("content/kontakt.md");
const services = (
  await Promise.all(
    (await readdir("content/tjanster"))
      .filter((f) => f.endsWith(".md"))
      .map(async (f) => ({ ...(await readMd(path.join("content/tjanster", f))), slug: path.parse(f).name })),
  )
).sort((a, b) => (a.ordning ?? 99) - (b.ordning ?? 99));

const siteUrl = (settings.webbadress || "https://authenticmovement.se").replace(/\/$/, "");
const abs = (p) => siteUrl + p;
const year = new Date().getFullYear();

const nav = [
  { href: "/#om-mig", label: "Om mig" },
  { href: "/#tjanster", label: "Tjänster" },
  { href: "/#mer-kunskap", label: "Mer kunskap" },
  { href: "/#kontakt", label: "Kontakt" },
];

// ---------- shared layout ----------

async function layout({ title, description, canonical, body, jsonLd }) {
  const logoHeader = await img(settings.logga, { alt: `${settings.varumarke}, till startsidan`, sizes: "56px", eager: true, maxWidth: 256 });
  const logoFooter = await img(settings.logga, { alt: `${settings.varumarke}, till startsidan`, sizes: "56px", maxWidth: 256 });
  const socials = [
    contact.facebook && { href: contact.facebook, label: "Facebook" },
    contact.instagram && { href: contact.instagram, label: "Instagram" },
  ].filter(Boolean);

  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(canonical)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sv_SE">
<meta property="og:site_name" content="${esc(settings.varumarke)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canonical)}">
${settings.delningsbild ? `<meta property="og:image" content="${abs(settings.delningsbild)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icon.png" type="image/png">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="preload" href="/fonts/lora-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/roboto-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${css}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<a class="skip-link" href="#innehall">Hoppa till innehållet</a>
<header class="site-header">
  <div class="container site-header__inner">
    <a class="logo logo--header" href="/">${logoHeader}</a>
    <nav class="main-nav" aria-label="Huvudmeny">
      <ul>${nav.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
    </nav>
    <button class="menu-button" type="button" aria-expanded="false" aria-controls="mobilmeny">
      <span class="menu-button__label">Meny</span>
      <span class="menu-button__icon" aria-hidden="true"><span></span><span></span></span>
    </button>
    <nav class="mobile-nav" id="mobilmeny" aria-label="Huvudmeny" hidden>
      <ul>${nav.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
    </nav>
  </div>
</header>
<main id="innehall">
${body}
</main>
<footer class="site-footer">
  <div class="container site-footer__inner">
    <div class="site-footer__about">
      <a class="logo logo--footer" href="/">${logoFooter}</a>
      <p>${esc(settings.sidfotstext)}</p>
    </div>
    <div class="site-footer__links">
      <nav aria-label="Sidfot">
        <ul><li><a href="/">Start</a></li>${nav.map((n) => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
      </nav>
      ${
        socials.length
          ? `<ul class="site-footer__social">${socials
              .map((s) => `<li><a href="${esc(s.href)}" rel="noopener noreferrer">${s.label}</a></li>`)
              .join("")}</ul>`
          : ""
      }
    </div>
  </div>
  <div class="container site-footer__copy"><p>© ${year} Jenny Davidsson. Alla rättigheter förbehållna.</p></div>
</footer>
<script src="/main.js" defer></script>
</body>
</html>
`;
}

// ---------- sections ----------

async function heroSection() {
  const lines = String(hero.rubrik || "").split("\n").filter(Boolean);
  const phone = contact.telefon;
  return `<section class="hero">
  ${await img(hero.bakgrundsbild, { alt: hero.bakgrundsbild_alt, className: "hero__bg", eager: true })}
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="hero__content">
    <div class="hero__text">
      <h1>
        <span class="hero__name">${esc(hero.namn)}</span>
        <span class="hero__title">${lines.map((l) => `<span>${esc(l)}</span>`).join("")}</span>
      </h1>
      ${hero.underrubrik ? `<p class="hero__intro">${esc(hero.underrubrik)}</p>` : ""}
      <div class="hero__buttons">
        <a class="pill pill--solid" href="#kontakt">${esc(hero.knapptext || "Boka tid")}</a>
        ${
          hero.visa_ringknapp !== false && phone
            ? `<a class="pill pill--outline" href="tel:${toTel(phone)}">Ring ${esc(phone)}</a>`
            : ""
        }
      </div>
    </div>
  </div>
</section>`;
}

async function aboutSection() {
  const facts = (about.fakta || [])
    .map(
      (f) =>
        `<div><dt class="eyebrow eyebrow--small">${esc(f.rubrik)}</dt>${(f.rader || [])
          .map((r) => `<dd>${esc(r)}</dd>`)
          .join("")}</div>`,
    )
    .join("");
  return `<section class="about" id="om-mig" aria-labelledby="om-mig-rubrik">
  <div class="container">
    <div class="about__head">
      <h2 id="om-mig-rubrik">${esc(about.rubrik)}</h2>
      ${about.ingress ? `<p>${esc(about.ingress)}</p>` : ""}
    </div>
    <div class="about__grid">
      <div class="about__portrait${about.svartvit ? " is-bw" : ""}">
        ${await img(about.portratt, { alt: about.portratt_alt, sizes: "(min-width: 1440px) 560px, (min-width: 768px) 40vw, 100vw" })}
      </div>
      <div class="about__card">
        ${about.roll ? `<p class="eyebrow eyebrow--small">${esc(about.roll)}</p>` : ""}
        <p class="about__card-title">${esc(about.kortrubrik)}</p>
        <div class="prose">${about.html}</div>
        ${facts ? `<dl class="about__facts">${facts}</dl>` : ""}
        <a class="text-link about__more" href="#tjanster">Se vad jag erbjuder <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </div>
</section>`;
}

async function servicesSection() {
  const cards = await Promise.all(
    services.map(
      async (s) => `<li>
        <a class="service-card${s.bild ? " has-image" : ""}" href="/tjanster/${s.slug}/">
          ${
            s.bild
              ? `${await img(s.bild, { sizes: "(min-width: 1440px) 420px, (min-width: 768px) 30vw, 100vw" })}<span class="service-card__shade" aria-hidden="true"></span>`
              : ""
          }
          <h3>${esc(s.titel)}</h3>
          <span class="service-card__more">Läs mer… <span aria-hidden="true">→</span></span>
        </a>
      </li>`,
    ),
  );
  return `<section class="services" id="tjanster" aria-labelledby="tjanster-rubrik">
  <div class="container">
    <h2 id="tjanster-rubrik" class="section-title">Mina tjänster</h2>
    <ul class="services__grid">${cards.join("")}</ul>
  </div>
</section>`;
}

function knowledgeSection() {
  const items = (knowledge.artiklar || [])
    .map(
      (a) => `<li>
        <div>
          <h3>${esc(a.titel)}</h3>
          ${a.beskrivning ? `<p>${esc(a.beskrivning)}</p>` : ""}
        </div>
        ${
          a.pdf
            ? `<a class="text-link" href="${esc(a.pdf)}">Läs PDF <span aria-hidden="true">→</span></a>`
            : `<span class="eyebrow eyebrow--small knowledge__soon">PDF kommer snart</span>`
        }
      </li>`,
    )
    .join("");
  return `<section class="knowledge" id="mer-kunskap" aria-labelledby="mer-kunskap-rubrik">
  <div class="container">
    <h2 id="mer-kunskap-rubrik">${esc(knowledge.rubrik)}</h2>
    <ul class="knowledge__list">${items}</ul>
    ${
      knowledge.avslutning
        ? `<p class="knowledge__end">${esc(knowledge.avslutning)} <a class="text-link" href="#kontakt">Kontakta Jenny</a></p>`
        : ""
    }
  </div>
</section>`;
}

function contactSection() {
  const details = [
    contact.telefon && { label: "Telefon", value: contact.telefon, href: `tel:${toTel(contact.telefon)}` },
    contact.epost && { label: "E-post", value: contact.epost, href: `mailto:${contact.epost}` },
  ].filter(Boolean);
  const options = services
    .map((s) => `<option value="${esc(s.titel)}" data-slug="${s.slug}">${esc(s.titel)}</option>`)
    .join("");

  return `<section class="contact" id="kontakt" aria-labelledby="kontakt-rubrik">
  <div class="container contact__grid">
    <div class="contact__head"><h2 id="kontakt-rubrik">${esc(contact.rubrik || "Kontakt")}</h2></div>

    <div class="contact__form">
      <form class="booking" name="bokning" method="POST" action="/tack/" data-netlify="true" netlify-honeypot="bot-field" novalidate>
        <input type="hidden" name="form-name" value="bokning">
        <input type="hidden" name="subject" value="Ny bokningsförfrågan från ${esc(siteUrl.replace(/^https?:\/\//, ""))}">
        <p hidden><label>Fyll inte i detta fält: <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="booking__row">
          <div>
            <label for="namn">Namn <span aria-hidden="true">*</span></label>
            <input id="namn" name="namn" autocomplete="name" placeholder="För- och efternamn" required>
            <p class="booking__error" id="namn-fel" hidden></p>
          </div>
          <div>
            <label for="email">E-post <span aria-hidden="true">*</span></label>
            <input id="email" name="email" type="email" autocomplete="email" placeholder="namn@exempel.se" required>
            <p class="booking__error" id="email-fel" hidden></p>
          </div>
        </div>
        <div class="booking__field">
          <label for="telefon">Telefon <span class="booking__hint">(valfritt)</span></label>
          <input id="telefon" name="telefon" type="tel" autocomplete="tel">
        </div>
        <div class="booking__field">
          <label for="intresse">Vad är du intresserad av? <span aria-hidden="true">*</span></label>
          <select id="intresse" name="intresse" required>
            <option value="" disabled selected>Välj ett alternativ</option>
            ${options}
            <option value="Annat">Annat</option>
          </select>
          <p class="booking__error" id="intresse-fel" hidden></p>
        </div>
        <div class="booking__field">
          <label for="meddelande">Meddelande <span class="booking__hint">(valfritt)</span></label>
          <textarea id="meddelande" name="meddelande" rows="5" placeholder="Hur kan Jenny hjälpa dig?"></textarea>
        </div>
        <p class="booking__alert" role="alert" hidden>Något gick fel och förfrågan skickades inte. Försök igen om en stund.</p>
        <button class="booking__submit" type="submit">Skicka förfrågan</button>
        <p class="booking__note">Fält markerade med * måste fyllas i.</p>
      </form>
      <div class="booking-success" tabindex="-1" hidden>
        <p class="booking-success__title">Tack för din förfrågan!</p>
        <p>Jenny återkommer så snart som möjligt.</p>
        <button type="button" class="booking-success__again">Skicka en ny förfrågan</button>
      </div>
    </div>

    <div class="contact__details">
      ${
        details.length
          ? `<div class="contact__block">
        <h3>Kontaktuppgifter</h3>
        <dl class="contact__list">${details
          .map(
            (d) =>
              `<div><dt class="eyebrow eyebrow--small">${d.label}</dt><dd><a href="${esc(d.href)}">${esc(d.value)}</a></dd></div>`,
          )
          .join("")}</dl>
      </div>`
          : ""
      }
      ${contact.adress ? `<div class="contact__block contact__address"><h3>Adress</h3><p>${esc(contact.adress)}</p></div>` : ""}
    </div>
  </div>
  ${
    contact.adress
      ? `<div class="container contact__map"><iframe title="Karta: ${esc(contact.adress)}" src="https://maps.google.com/maps?q=${encodeURIComponent(
          contact.adress,
        )}&amp;output=embed" loading="lazy"></iframe></div>`
      : ""
  }
</section>`;
}

// ---------- structured data ----------

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": abs("/#verksamhet"),
      name: settings.varumarke,
      description: settings.beskrivning,
      url: abs("/"),
      logo: abs("/icon.png"),
      image: [settings.delningsbild && abs(settings.delningsbild), about.portratt && abs(about.portratt)].filter(Boolean),
      founder: { "@id": abs("/#jenny") },
      ...(contact.epost && { email: contact.epost }),
      ...(contact.telefon && { telephone: toTel(contact.telefon) }),
      ...(contact.adress && { address: contact.adress }),
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Tjänster",
        itemListElement: services.map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s.titel, description: s.beskrivning, url: abs(`/tjanster/${s.slug}/`) },
        })),
      },
    },
    {
      "@type": "Person",
      "@id": abs("/#jenny"),
      name: "Jenny Davidsson",
      jobTitle: "Dans- och rörelseterapeut",
      description: about.ingress,
      ...(about.portratt && { image: abs(about.portratt) }),
      worksFor: { "@id": abs("/#verksamhet") },
    },
  ],
};

// ---------- pages ----------

const SERVICE_PAGE_DEFAULT = "Hör av dig för mer information.";

async function servicePage(s) {
  const body = `<article class="service-page">
  <div class="container">
    <div class="service-page__inner">
      <a class="back-link" href="/#tjanster"><span aria-hidden="true">←</span> Alla tjänster</a>
      <h1>${esc(s.titel)}</h1>
      ${s.beskrivning ? `<p class="service-page__lead">${esc(s.beskrivning)}</p>` : ""}
      ${s.bild ? `<div class="service-page__image">${await img(s.bild, { alt: s.bild_alt, sizes: "(min-width: 768px) 720px, 100vw", eager: true })}</div>` : ""}
      ${s.html ? `<div class="prose prose--large">${s.html}</div>` : ""}
      <p class="service-page__details">${esc(s.detaljer || SERVICE_PAGE_DEFAULT)}</p>
      <a class="button" href="/?intresse=${s.slug}#kontakt">${esc(s.knapptext || "Kontakta Jenny")} <span aria-hidden="true">→</span></a>
    </div>
  </div>
</article>`;
  return layout({
    title: `${s.titel} – Jenny Davidsson | ${settings.varumarke}`,
    description: s.beskrivning || settings.beskrivning,
    canonical: `/tjanster/${s.slug}/`,
    body,
  });
}

function simplePage(title, text) {
  return `<div class="container simple-page">
  <h1>${title}</h1>
  <p>${text}</p>
  <a class="button" href="/">Till startsidan</a>
</div>`;
}

// ---------- write ----------

const css = (await readFile("src/styles.css", "utf8")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s*\n\s*/g, "\n");

await rm(OUT, { recursive: true, force: true }).catch(() => {});
await mkdir(IMG_OUT, { recursive: true });
await cp("static", OUT, { recursive: true });
await cp("src/main.js", path.join(OUT, "main.js"));

// Fonts (self-hosted, latin covers å ä ö).
await mkdir(path.join(OUT, "fonts"), { recursive: true });
for (const f of [
  "@fontsource/roboto/files/roboto-latin-300-normal.woff2",
  "@fontsource/roboto/files/roboto-latin-400-normal.woff2",
  "@fontsource/roboto/files/roboto-latin-500-normal.woff2",
  "@fontsource/lora/files/lora-latin-400-normal.woff2",
  "@fontsource/lora/files/lora-latin-700-normal.woff2",
]) {
  await cp(path.join("node_modules", f), path.join(OUT, "fonts", path.basename(f)));
}

// Favicon: the white logo on the brand colour.
if (settings.logga && existsSync(path.join("static", settings.logga))) {
  const logo = await sharp(path.join("static", settings.logga)).resize(380, 380, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#8B3A3A" } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(OUT, "icon.png"));
}

const home = [await heroSection(), await aboutSection(), await servicesSection(), knowledgeSection(), contactSection()].join("\n");
await writeFile(
  path.join(OUT, "index.html"),
  await layout({ title: settings.titel, description: settings.beskrivning, canonical: "/", body: home, jsonLd }),
);

for (const s of services) {
  await mkdir(path.join(OUT, "tjanster", s.slug), { recursive: true });
  await writeFile(path.join(OUT, "tjanster", s.slug, "index.html"), await servicePage(s));
}

await mkdir(path.join(OUT, "tack"), { recursive: true });
await writeFile(
  path.join(OUT, "tack/index.html"),
  await layout({
    title: `Tack! | ${settings.varumarke}`,
    description: "Din förfrågan är skickad.",
    canonical: "/tack/",
    body: simplePage("Tack för din förfrågan!", "Jenny återkommer så snart som möjligt."),
  }),
);
await writeFile(
  path.join(OUT, "404.html"),
  await layout({
    title: `Sidan hittades inte | ${settings.varumarke}`,
    description: "Sidan finns inte.",
    canonical: "/404.html",
    body: simplePage("Sidan hittades inte", "Sidan du letar efter finns inte eller har flyttats."),
  }),
);

const urls = ["/", ...services.map((s) => `/tjanster/${s.slug}/`)];
await writeFile(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${abs(u)}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
await writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${abs("/sitemap.xml")}\n`);

console.log(`✓ Byggt ${urls.length + 2} sidor till ${OUT}/ (${imageCache.size} bilder optimerade)`);
