export function clean(value, max=500) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

export function normalize(value) {
  return clean(value, 500)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g,"i").replace(/ş/g,"s").replace(/ğ/g,"g")
    .replace(/ü/g,"u").replace(/ö/g,"o").replace(/ç/g,"c")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}

export function docId(value) {
  return clean(value, 220).replace(/[\\/]+/g, "_").slice(0, 200);
}

export function hash(value) {
  let h = 2166136261;
  String(value).split("").forEach((ch) => {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  });
  return (h >>> 0).toString(36);
}

export function canonicalUrl(value) {
  const raw = clean(value, 2000);
  if (!raw) return "";
  try {
    const u = new URL(raw, "https://www.verudanava.com/");
    const host = u.hostname.toLowerCase();
    if (!["verudanava.blogspot.com","verudanava.com","www.verudanava.com"].includes(host)) return "";
    u.protocol = "https:";
    u.hostname = "www.verudanava.com";
    u.port = "";
    u.hash = "";
    return u.href;
  } catch {
    return "";
  }
}

export function labels(entry) {
  return (Array.isArray(entry?.category) ? entry.category : [])
    .map((x) => clean(x?.term, 220)).filter(Boolean);
}

export function postId(entry) {
  const raw = clean(entry?.id?.$t, 500);
  const match = raw.match(/post-(\d+)/i);
  return match ? match[1] : raw;
}

export function alternateLink(entry) {
  const item = (Array.isArray(entry?.link) ? entry.link : [])
    .find((x) => x?.rel === "alternate" && x?.href);
  return canonicalUrl(item?.href);
}

const GENERIC = new Set([
  "bolum","bölüm","chapter","ch","episode","ep",
  "cilt","volume","vol",
  "light novel","web novel","novel","ln","wn",
  "manga","manhwa","manhua","series","nsfw",
  "guncel","güncel","tamamlandi","tamamlandı","beklemede"
]);

export function isGenericLabel(value) {
  const n = normalize(value);
  return !n || GENERIC.has(n)
    || /^(cilt|volume|vol)\s*\d/.test(n)
    || /^(bolum|chapter|ch|episode|ep)\s*\d/.test(n);
}

export function stripVolumeSuffix(value) {
  return clean(value, 500)
    .replace(/\s+(?:cilt|volume|vol\.?)\s*\d+(?:\.\d+)?(?:\s.*)?$/i, "")
    .trim();
}

export function relationCandidates(labelList) {
  const out = new Set();
  for (const raw of labelList) {
    if (isGenericLabel(raw)) continue;
    const stripped = normalize(stripVolumeSuffix(raw));
    if (stripped.length >= 2) out.add(stripped);
    const full = normalize(raw);
    if (full.length >= 2) out.add(full);
  }
  return [...out];
}

export function releaseKind(title, labelList) {
  const n = labelList.map(normalize);
  const t = normalize(title);
  if (n.some((x) => ["bolum","chapter","ch","episode","ep"].includes(x))
      || /\b(bolum|chapter|ch|episode|ep)\s*\d/.test(t)) return "chapter";
  if (n.some((x) => ["cilt","volume","vol"].includes(x))
      || /\b(cilt|volume|vol)\s*\d/.test(t)) return "volume";
  return "";
}

export function titlePrefix(title) {
  return normalize(clean(title, 500).split(
    /\b(?:cilt|volume|vol\.?|bölüm|bolum|chapter|ch\.?|episode|ep\.?)\s*\d/i
  )[0]);
}

export function parseEntry(entry) {
  const title = clean(entry?.title?.$t, 500);
  const labelList = labels(entry);
  const published = clean(entry?.published?.$t, 80);
  return {
    postId: postId(entry),
    title,
    url: alternateLink(entry),
    labels: labelList,
    candidates: relationCandidates(labelList),
    kind: releaseKind(title, labelList),
    titlePrefix: titlePrefix(title),
    publishedMs: Date.parse(published) || 0
  };
}

function aliasVariants(value) {
  const raw = clean(value, 500);
  const out = new Set();
  const n = normalize(raw);
  if (n) out.add(n);
  (raw.match(/\(([^)]+)\)/g) || []).forEach((part) => {
    const x = normalize(part.slice(1, -1));
    if (x) out.add(x);
  });
  raw.split(/[|/]/).forEach((part) => {
    const x = normalize(part);
    if (x) out.add(x);
  });
  return out;
}

export function seriesRecord(id, data, extraAliases=[]) {
  const aliases = new Set();
  aliasVariants(data?.title).forEach((x) => aliases.add(x));

  const url = canonicalUrl(data?.url);
  if (url) {
    try {
      const slug = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
      const x = normalize(slug.replace(/\.html$/i, "").replace(/-/g, " "));
      if (x) aliases.add(x);
    } catch {}
  }

  for (const extra of extraAliases) {
    aliasVariants(stripVolumeSuffix(extra) || extra).forEach((x) => aliases.add(x));
  }

  return { id: docId(id), title: clean(data?.title, 240), url, aliases };
}

export function resolveSeries(release, catalog) {
  if (!release?.kind || !catalog.length) return null;
  const candidates = new Set(
    [release.titlePrefix, ...(release.candidates || [])].filter((x) => x && x.length >= 2)
  );
  const scores = new Map();

  for (const candidate of candidates) {
    for (const series of catalog) {
      let score = series.aliases.has(candidate) ? 10 : 0;
      if (!score) {
        for (const alias of series.aliases) {
          if (alias.length >= 4 && candidate.length >= 4
              && (alias.startsWith(candidate + " ") || candidate.startsWith(alias + " "))) {
            score = Math.max(score, 1);
          }
        }
      }
      if (score) scores.set(series.id, (scores.get(series.id) || 0) + score);
    }
  }

  if (!scores.size) return null;
  const ranked = [...scores.entries()].sort((a,b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  return catalog.find((s) => s.id === ranked[0][0]) || null;
}

export function releaseId(seriesId, url) {
  return docId(docId(seriesId) + "_" + hash(canonicalUrl(url)));
}

export function hrefsFromHtml(html, baseUrl) {
  const out = new Set();
  const rx = /\bhref\s*=\s*["']([^"'#]+)["']/gi;
  let match;
  while ((match = rx.exec(String(html || "")))) {
    try {
      const u = canonicalUrl(new URL(match[1], baseUrl).href);
      if (u) out.add(u);
    } catch {}
  }
  return [...out];
}
