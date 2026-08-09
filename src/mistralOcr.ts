import type { SourceCandidate } from "./sourceCandidates";

export type OcrStats = {
  provider: "mistral-ocr";
  enabled: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
};

type MistralOcrResponse = {
  pages?: Array<{ markdown?: string }>;
  message?: string;
};

const mistralOcrUrl = "https://api.mistral.ai/v1/ocr";

export function readMistralApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.MISTRAL_API_KEY?.trim();
  return key || undefined;
}

export function createOcrStats(enabled: boolean): OcrStats {
  return { provider: "mistral-ocr", enabled, attempted: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
}

export async function enrichCandidatesWithMistralOcr(
  candidates: SourceCandidate[],
  options: { apiKey?: string; fetcher?: typeof fetch } = {},
): Promise<{ candidates: Array<SourceCandidate & { visionText?: string }>; stats: OcrStats }> {
  const apiKey = options.apiKey;
  const stats = createOcrStats(Boolean(apiKey));
  if (!apiKey) {
    stats.skipped = candidates.length;
    return { candidates, stats };
  }

  const fetcher = options.fetcher ?? fetch;
  const enriched: Array<SourceCandidate & { visionText?: string }> = [];
  for (const candidate of candidates) {
    stats.attempted += 1;
    try {
      const response = await fetcher(mistralOcrUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: { type: "image_url", image_url: candidate.imageUrl },
          include_image_base64: false,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
        throw new Error(`Mistral OCR returned ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = (await response.json()) as MistralOcrResponse;
      const visionText = payload.pages?.map((page) => page.markdown ?? "").filter(Boolean).join("\n");
      if (!visionText) throw new Error(payload.message ?? "Mistral OCR did not return extracted text");

      enriched.push({ ...candidate, visionText });
      stats.succeeded += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`${candidate.id}: ${error instanceof Error ? error.message : "unknown OCR error"}`);
      enriched.push(candidate);
    }
  }

  return { candidates: enriched, stats };
}
