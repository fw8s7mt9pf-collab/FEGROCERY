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
  pages?: Array<{
    markdown?: string;
    blocks?: Array<{ content?: string }>;
    confidence_scores?: { average_page_confidence_score?: number; minimum_page_confidence_score?: number };
  }>;
  message?: string;
};

export type MistralOcrCandidate = SourceCandidate & {
  visionText?: string;
  ocrDiagnostics?: {
    markdown: string;
    blockText: string;
    averageConfidence?: number;
    minimumConfidence?: number;
  };
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
): Promise<{ candidates: MistralOcrCandidate[]; stats: OcrStats }> {
  const apiKey = options.apiKey;
  const stats = createOcrStats(Boolean(apiKey));
  if (!apiKey) {
    stats.skipped = candidates.length;
    return { candidates, stats };
  }

  const fetcher = options.fetcher ?? fetch;
  const enriched: MistralOcrCandidate[] = [];
  for (const candidate of candidates) {
    stats.attempted += 1;
    try {
      let response = await fetcher(mistralOcrUrl, ocrRequest(apiKey, candidate.imageUrl));
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
        if (response.status !== 400 || !/could not be fetched/i.test(detail)) {
          throw new Error(`Mistral OCR returned ${response.status}${detail ? `: ${detail}` : ""}`);
        }

        const imageResponse = await fetcher(candidate.imageUrl, { signal: AbortSignal.timeout(45_000) });
        if (!imageResponse.ok) throw new Error(`Flyer download returned ${imageResponse.status}`);
        const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || mediaTypeFromUrl(candidate.imageUrl);
        const dataUrl = `data:${mimeType};base64,${Buffer.from(await imageResponse.arrayBuffer()).toString("base64")}`;
        response = await fetcher(mistralOcrUrl, ocrRequest(apiKey, dataUrl));
        if (!response.ok) {
          const retryDetail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
          throw new Error(`Mistral OCR returned ${response.status}${retryDetail ? `: ${retryDetail}` : ""}`);
        }
      }

      const payload = (await response.json()) as MistralOcrResponse;
      const markdown = payload.pages?.map((page) => page.markdown ?? "").filter(Boolean).join("\n") ?? "";
      const blockText = payload.pages
        ?.flatMap((page) => page.blocks?.map((block) => block.content ?? "") ?? [])
        .filter(Boolean)
        .join("\n") ?? "";
      const visionText = [markdown, blockText].filter(Boolean).join("\n");
      if (!visionText) throw new Error(payload.message ?? "Mistral OCR did not return extracted text");

      const confidenceScores = payload.pages?.[0]?.confidence_scores;
      enriched.push({
        ...candidate,
        visionText,
        ocrDiagnostics: {
          markdown,
          blockText,
          averageConfidence: confidenceScores?.average_page_confidence_score,
          minimumConfidence: confidenceScores?.minimum_page_confidence_score,
        },
      });
      stats.succeeded += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`${candidate.id}: ${error instanceof Error ? error.message : "unknown OCR error"}`);
      enriched.push(candidate);
    }
  }

  return { candidates: enriched, stats };
}

function ocrRequest(apiKey: string, imageUrl: string): RequestInit {
  return {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: { type: "image_url", image_url: imageUrl },
      include_image_base64: false,
      include_blocks: true,
      confidence_scores_granularity: "page",
    }),
    signal: AbortSignal.timeout(45_000),
  };
}

function mediaTypeFromUrl(url: string): string {
  const extension = url.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return `image/${extension || "png"}`;
}
