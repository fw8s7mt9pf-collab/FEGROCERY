export type SourceCandidate = {
  id: string;
  supermarket: string;
  sourceUrl: string;
  imageUrl: string;
  discoveredAt: string;
  rawTitle?: string;
  rawCaption?: string;
  mediaType?: string;
};

export type CollectorResult = {
  candidates: SourceCandidate[];
  skipped: string[];
};

export type ApifyInstagramPost = {
  type?: "Image" | "Sidecar" | "Video" | string;
  shortCode?: string;
  url?: string;
  caption?: string;
  timestamp?: string;
  displayUrl?: string;
  childPosts?: ApifyInstagramPost[];
  carouselImages?: string[];
  images?: string[];
  error?: string;
  errorDescription?: string;
  inputUrl?: string;
};

const imageUrlPattern = /https?:\/\/[^"' <>)]+wp-content\/uploads\/[^"' <>)]+\.(?:jpe?g|png|webp|avif)/gi;
const grupoRoxoPromotionsUrl = "https://www.gruporoxo.com.br/promocoes/";

export function collectGrupoRoxoCandidates(html: string, discoveredAt: string): CollectorResult {
  const candidates: SourceCandidate[] = [];
  const skipped: string[] = [];
  const itemPattern = /<li\b[\s\S]*?<\/li>/gi;
  const items = html.match(itemPattern) ?? [];

  for (const item of items) {
    if (!item.includes("wpzoom-instagram")) continue;
    const imageUrl = firstMatch(item, /data-src=["']([^"']+)["']/i) ?? firstImageUrl(item);
    if (!imageUrl) {
      skipped.push("Grupo Roxo widget item without image URL");
      continue;
    }

    const rawTitle = repairMojibake(decodeHtml(firstMatch(item, /title=["']([^"']+)["']/i) ?? ""));
    const rawCaption = repairMojibake(decodeHtml(firstMatch(item, /alt=["']([^"']+)["']/i) ?? ""));
    if (!/ofertas?/i.test(`${rawTitle} ${rawCaption}`)) continue;

    candidates.push({
      id: stableCandidateId("grupo-roxo", imageUrl, imageUrl),
      supermarket: "Grupo Roxo",
      sourceUrl: grupoRoxoPromotionsUrl,
      imageUrl: decodeHtml(imageUrl),
      discoveredAt,
      rawTitle,
      rawCaption,
      mediaType: firstMatch(item, /data-media-type=["']([^"']+)["']/i),
    });
  }

  return dedupeResult(candidates, skipped);
}

export function collectKrolowCandidates(html: string, discoveredAt: string): CollectorResult {
  const candidates: SourceCandidate[] = [];
  const skipped: string[] = [];
  const offersSection = krolowOffersSection(html);
  const flyerUrls = offersSection
    ? [...offersSection.matchAll(imageUrlPattern)].map((match) => canonicalImageUrl(decodeHtml(match[0])))
    : [];

  for (const imageUrl of flyerUrls) {
    candidates.push({
      id: stableCandidateId("krolow", imageUrl, imageUrl),
      supermarket: "Krolow",
      sourceUrl: "https://macroatacadokrolow.com.br/",
      imageUrl,
      discoveredAt,
      rawTitle: "Ofertas Krolow",
      rawCaption: "Ofertas Krolow",
      mediaType: fileExtension(imageUrl),
    });
  }

  if (!flyerUrls.length) {
    skipped.push('Krolow "Ofertas Especiais Feitas Para Voce" section did not expose flyer images');
  }

  return dedupeResult(candidates, skipped);
}

export function collectMercadoPradoCandidates(
  posts: ApifyInstagramPost[],
  discoveredAt: string,
  lookbackDays = 7,
): CollectorResult {
  const candidates: SourceCandidate[] = [];
  const skipped: string[] = [];
  const discoveredAtTime = new Date(discoveredAt).getTime();
  const cutoff = discoveredAtTime - lookbackDays * 24 * 60 * 60 * 1_000;
  for (const post of posts) {
    if (post.error) {
      skipped.push(
        `Mercado Prado Apify error (${post.error}): ${post.errorDescription || "No description provided"}`,
      );
      continue;
    }
    const publishedAt = Date.parse(post.timestamp ?? "");
    if (
      !post.shortCode ||
      post.type?.toLowerCase() === "video" ||
      !Number.isFinite(publishedAt) ||
      publishedAt < cutoff ||
      publishedAt > discoveredAtTime
    ) continue;

    const sourceUrl = post.url || `https://www.instagram.com/p/${post.shortCode}/`;
    const rawCaption = post.caption ?? "";
    const rawTitle = rawCaption.split("\n")[0]?.trim() || "Mercado Prado";
    const imageUrls = post.carouselImages?.length ? post.carouselImages : post.images;
    const media = post.childPosts?.length
      ? post.childPosts
      : imageUrls?.length
        ? imageUrls.map((displayUrl) => ({ type: "Image", displayUrl }))
        : [post];

    media.forEach((item, index) => {
      if (!item.displayUrl || item.type?.toLowerCase() === "video") return;
      candidates.push({
        id: stableCandidateId("mercado-prado", `${sourceUrl}slide-${index + 1}`, item.displayUrl),
        supermarket: "Mercado Prado",
        sourceUrl,
        imageUrl: decodeHtml(item.displayUrl),
        discoveredAt,
        rawTitle,
        rawCaption,
        mediaType: fileExtension(item.displayUrl) ?? "image",
      });
    });
  }

  if (!posts.length) skipped.push("Mercado Prado Instagram profile did not expose recent posts");
  if (posts.length && !candidates.length && !skipped.length) {
    skipped.push(`Mercado Prado had no image posts from the last ${lookbackDays} days`);
  }
  return dedupeResult(candidates, skipped);
}

function krolowOffersSection(html: string): string | undefined {
  const heading = /Ofertas\s+Especiais[\s\S]{0,160}?Feitas\s+Para\s+Voc(?:e|ê|&ecirc;)/i.exec(html);
  if (heading?.index === undefined) return undefined;

  const sectionStart = heading.index + heading[0].length;
  const remainder = html.slice(sectionStart);
  const end = /Verifique\s+a\s+data\s+de\s+validade\s+das\s+ofertas/i.exec(remainder)?.index;
  return remainder.slice(0, end ?? undefined);
}

export function stableCandidateId(supermarket: string, sourceUrl: string, imageUrl: string): string {
  return `${supermarket}:${sourceUrl || imageUrl}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function retainMissingSources(
  fresh: SourceCandidate[],
  previous: SourceCandidate[],
  supermarkets: string[],
): SourceCandidate[] {
  const refreshed = new Set(fresh.map((candidate) => candidate.supermarket));
  const retained = previous.filter(
    (candidate) => supermarkets.includes(candidate.supermarket) && !refreshed.has(candidate.supermarket),
  );
  return [...fresh, ...retained];
}

function dedupeResult(candidates: SourceCandidate[], skipped: string[]): CollectorResult {
  const seen = new Set<string>();
  return {
    candidates: candidates.filter((candidate) => {
      const key = candidate.imageUrl;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    skipped,
  };
}

function firstImageUrl(value: string): string | undefined {
  return value.match(imageUrlPattern)?.[0];
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function canonicalImageUrl(url: string): string {
  return url.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp|avif)$)/i, "");
}

function fileExtension(url: string): string | undefined {
  return url.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function repairMojibake(value: string): string {
  if (!/[ÃÂð]/.test(value)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 0xff)));
}
