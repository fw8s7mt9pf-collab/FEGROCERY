import type { SourceCandidate } from "./sourceCandidates";

export type OcrStats = {
  provider: "ocr.space";
  enabled: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
};

type OcrSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[];
  ErrorDetails?: string;
  ParsedResults?: Array<{ ParsedText?: string }>;
};

export function readOcrSpaceApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.OCR_SPACE_API_KEY?.trim();
  return key || undefined;
}

export function createOcrStats(enabled: boolean): OcrStats {
  return { provider: "ocr.space", enabled, attempted: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
}

export async function enrichCandidatesWithOcrSpace(
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
      const response = await fetcher("https://api.ocr.space/parse/image", {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: candidate.imageUrl,
          language: "por",
          OCREngine: "2",
          scale: "true",
          detectOrientation: "true",
          isTable: "true",
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 240);
        throw new Error(`OCR.Space returned ${response.status}${detail ? `: ${detail}` : ""}`);
      }

      const payload = (await response.json()) as OcrSpaceResponse;
      if (payload.IsErroredOnProcessing || !payload.ParsedResults?.length) {
        throw new Error(formatApiError(payload));
      }

      enriched.push({
        ...candidate,
        visionText: payload.ParsedResults.map((result) => result.ParsedText ?? "").join("\n"),
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

function formatApiError(payload: OcrSpaceResponse): string {
  const message = [...(payload.ErrorMessage ?? []), payload.ErrorDetails].filter(Boolean).join(" ");
  return message || "OCR.Space did not return parsed text";
}
