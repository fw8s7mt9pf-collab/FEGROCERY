import { categories, type Category } from "./deals";
import type { MistralOcrCandidate } from "./mistralOcr";

export type AiParserStats = {
  provider: "mistral-chat";
  enabled: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export type ParsedFlyerListing = {
  title?: string;
  category?: Category;
  validFrom?: string;
  validUntil?: string;
  summary?: string;
  productNames?: string[];
  productCount?: number;
  hasMoreThanThreeProducts?: boolean;
};

export type AiParsedCandidate = MistralOcrCandidate & {
  parsedListing?: ParsedFlyerListing;
};

type MistralChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  message?: string;
};

const mistralChatUrl = "https://api.mistral.ai/v1/chat/completions";

export function createAiParserStats(enabled: boolean): AiParserStats {
  return { provider: "mistral-chat", enabled, attempted: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
}

export async function enrichCandidatesWithAiParsedListings(
  candidates: MistralOcrCandidate[],
  options: { apiKey?: string; fetcher?: typeof fetch; referenceDate?: Date; retryDelayMs?: number } = {},
): Promise<{ candidates: AiParsedCandidate[]; stats: AiParserStats }> {
  const apiKey = options.apiKey;
  const stats = createAiParserStats(Boolean(apiKey));
  if (!apiKey) {
    stats.skipped = candidates.length;
    return { candidates, stats };
  }

  const fetcher = options.fetcher ?? fetch;
  const enriched: AiParsedCandidate[] = [];
  for (const candidate of candidates) {
    if (candidate.parsedListing) {
      stats.skipped += 1;
      enriched.push(candidate);
      continue;
    }
    if (!candidate.visionText?.trim()) {
      stats.skipped += 1;
      enriched.push(candidate);
      continue;
    }

    stats.attempted += 1;
    try {
      const response = await fetchMistralChat(fetcher, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-large-latest",
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                `Extract one grocery flyer from OCR. Return exactly one top-level JSON object with these keys: category, validFrom, validUntil, productCount, productNames, hasMoreThanThreeProducts, summary. category must be one of: ${categories.join(", ")}. Use Alcohol for beer, wine, spirits, and other alcoholic drinks. Count distinct promoted products visible on this flyer. If it has 1 to 3 products, productNames must contain every product name and hasMoreThanThreeProducts must be false. If it has more than 3 products, productNames must be an empty array and hasMoreThanThreeProducts must be true. Dates must be ISO 8601 strings in Brazil time. When the flyer omits the year, use the year from referenceDate; never choose an earlier year unless that year is explicitly printed. Use null for unknown dates. Do not include prices in product names. Do not invent dates or products.`,
            },
            {
              role: "user",
              content: JSON.stringify({
                supermarket: candidate.supermarket,
                sourceUrl: candidate.sourceUrl,
                imageUrl: candidate.imageUrl,
                referenceDate: (options.referenceDate ?? new Date()).toISOString(),
                ocrText: candidate.visionText,
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      }, options.retryDelayMs ?? 2_000);
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
        throw new Error(`Mistral chat returned ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = (await response.json()) as MistralChatResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error(payload.message ?? "Mistral chat did not return content");

      const parsed = normalizeParsedListing(JSON.parse(content));
      enriched.push({ ...candidate, parsedListing: parsed });
      stats.succeeded += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`${candidate.id}: ${error instanceof Error ? error.message : "unknown parser error"}`);
      enriched.push(candidate);
    }
  }

  return { candidates: enriched, stats };
}

function normalizeParsedListing(value: unknown): ParsedFlyerListing {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    title: cleanString(record.title),
    category: parseCategory(record.category),
    validFrom: parseIsoString(record.validFrom),
    validUntil: parseIsoString(record.validUntil),
    summary: cleanString(record.summary),
    productNames: parseProductNames(record.productNames),
    productCount: parseProductCount(record.productCount),
    hasMoreThanThreeProducts: parseBoolean(record.hasMoreThanThreeProducts),
  };
}

async function fetchMistralChat(fetcher: typeof fetch, init: RequestInit, retryDelayMs: number): Promise<Response> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetcher(mistralChatUrl, init);
    if (response.status !== 429 || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
  }
  return response as Response;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function parseCategory(value: unknown): Category | undefined {
  if (typeof value !== "string") return undefined;
  return categories.includes(value as Category) ? (value as Category) : undefined;
}

function parseIsoString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function parseProductNames(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const names = [...new Set(value.map(cleanString).filter((name): name is string => Boolean(name)))].slice(0, 20);
  return names;
}

function parseProductCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

function parseBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
