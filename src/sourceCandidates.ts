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

const imageUrlPattern = /https?:\/\/[^"' <>)]+wp-content\/uploads\/[^"' <>)]+\.(?:jpe?g|png|webp)/gi;
const instagramLinkPattern = /https?:\/\/(?:www\.)?instagram\.com\/[^"' <>)]+/i;

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

    const sourceUrl = firstMatch(item, /href=["']([^"']*instagram\.com[^"']*)["']/i) ?? "https://www.gruporoxo.com.br/promocoes/";
    candidates.push({
      id: stableCandidateId("grupo-roxo", sourceUrl, imageUrl),
      supermarket: "Grupo Roxo",
      sourceUrl: decodeHtml(sourceUrl),
      imageUrl: decodeHtml(imageUrl),
      discoveredAt,
      rawTitle: repairMojibake(decodeHtml(firstMatch(item, /title=["']([^"']+)["']/i) ?? "")),
      rawCaption: repairMojibake(decodeHtml(firstMatch(item, /alt=["']([^"']+)["']/i) ?? "")),
      mediaType: firstMatch(item, /data-media-type=["']([^"']+)["']/i),
    });
  }

  return dedupeResult(candidates, skipped);
}

export function collectKrolowCandidates(html: string, discoveredAt: string): CollectorResult {
  const candidates: SourceCandidate[] = [];
  const skipped: string[] = [];
  const urls = [...html.matchAll(imageUrlPattern)].map((match) => canonicalImageUrl(decodeHtml(match[0])));
  const flyerUrls = urls.filter((url) => /WhatsApp-Image/i.test(url));

  for (const imageUrl of flyerUrls) {
    candidates.push({
      id: stableCandidateId("krolow", "https://macroatacadokrolow.com.br/", imageUrl),
      supermarket: "Krolow",
      sourceUrl: "https://macroatacadokrolow.com.br/",
      imageUrl,
      discoveredAt,
    });
  }

  if (!flyerUrls.length) {
    skipped.push("Krolow homepage did not expose WhatsApp-Image flyer URLs");
  }

  return dedupeResult(candidates, skipped);
}

export function stableCandidateId(supermarket: string, sourceUrl: string, imageUrl: string): string {
  return `${supermarket}:${sourceUrl || imageUrl}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dedupeResult(candidates: SourceCandidate[], skipped: string[]): CollectorResult {
  const seen = new Set<string>();
  return {
    candidates: candidates.filter((candidate) => {
      const key = candidate.sourceUrl.match(instagramLinkPattern)?.[0] ?? candidate.imageUrl;
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
  return url.replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp)$)/i, "");
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
