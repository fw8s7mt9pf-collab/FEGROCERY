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
  options: { apiKey?: string; fetcher?: typeof fetch; referenceDate?: Date } = {},
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
    if (!candidate.visionText?.trim()) {
      stats.skipped += 1;
      enriched.push(candidate);
      continue;
    }

    stats.attempted += 1;
    try {
      const response = await fetcher(mistralChatUrl, {
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
                "Extract grocery flyer listing data from OCR. Return only JSON with optional keys: title, category, validFrom, validUntil, summary. category must be one of: Meats, Produce, Basic Groceries, Cleaning, Hygiene, Beverages, Bakery, Frozen, Other. Dates must be ISO 8601 strings for Brazil time when present. Do not invent dates or products.",
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
      });
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
  };
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
