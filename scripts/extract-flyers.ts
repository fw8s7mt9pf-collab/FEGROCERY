import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractDealsFromCandidates } from "../src/flyerExtraction";
import type { SourceCandidate } from "../src/sourceCandidates";
import { enrichCandidatesWithAiParsedListings } from "../src/flyerAiParser";
import { enrichCandidatesWithMistralOcr, readMistralApiKey } from "../src/mistralOcr";

type RawCandidatePayload = {
  generatedAt?: string;
  candidates: SourceCandidate[];
  skipped?: string[];
};

const inputPath = "public/data/raw-candidates.json";
const dealsOutputPath = "public/data/deals.json";
const expiredDealsOutputPath = "public/data/expired-deals.json";
const debugOutputPath = "public/data/extraction-debug.json";
const refreshDebugOutputPath = "public/data/refresh-debug.json";

async function main(): Promise<void> {
  const payload = JSON.parse(await readFile(inputPath, "utf8")) as RawCandidatePayload;
  const refreshedAt = new Date();
  const apiKey = readMistralApiKey();
  const ocr = await enrichCandidatesWithMistralOcr(payload.candidates, { apiKey });
  const parser = await enrichCandidatesWithAiParsedListings(ocr.candidates, { apiKey, referenceDate: refreshedAt });
  const result = extractDealsFromCandidates(parser.candidates, refreshedAt);

  await mkdir(dirname(dealsOutputPath), { recursive: true });
  await writeFile(dealsOutputPath, `${JSON.stringify(result.currentDeals, null, 2)}\n`, "utf8");
  await writeFile(expiredDealsOutputPath, `${JSON.stringify(result.expiredDeals, null, 2)}\n`, "utf8");
  await writeFile(
    debugOutputPath,
    `${JSON.stringify(
      {
        generatedAt: refreshedAt.toISOString(),
        warnings: result.warnings,
        ocrDateDiagnostics: ocr.candidates.map((candidate) => ({
          id: candidate.id,
          markdownEvidence: dateEvidence(candidate.ocrDiagnostics?.markdown),
          blockEvidence: dateEvidence(candidate.ocrDiagnostics?.blockText),
          averageConfidence: candidate.ocrDiagnostics?.averageConfidence,
          minimumConfidence: candidate.ocrDiagnostics?.minimumConfidence,
          parsedListing: parser.candidates.find((parsed) => parsed.id === candidate.id)?.parsedListing,
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    refreshDebugOutputPath,
    `${JSON.stringify(
      {
        generatedAt: refreshedAt.toISOString(),
        sourceGeneratedAt: payload.generatedAt,
        sourceCandidateCount: payload.candidates.length,
        sourceSkippedCount: payload.skipped?.length ?? 0,
        sourceSkipped: payload.skipped ?? [],
        publicDealCount: result.currentDeals.length,
        expiredDealCount: result.expiredDeals.length,
        warningCount: result.warnings.length,
        warnings: result.warnings,
        ocr: ocr.stats,
        aiParser: parser.stats,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`Wrote ${result.currentDeals.length} public deals to ${dealsOutputPath}`);
  console.log(`Wrote ${result.expiredDeals.length} expired deals to ${expiredDealsOutputPath}`);
  if (result.warnings.length) {
    console.warn(`Extraction warnings: ${result.warnings.length}`);
  }
}

function dateEvidence(text: string | undefined): string[] {
  if (!text) return [];
  const normalized = text.replace(/\s+/g, " ");
  return [...normalized.matchAll(/.{0,50}(?:valid|\d{1,2}\s*(?:à|a|e|ate|até)\s*\d{1,2}|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro).{0,80}/gi)]
    .map((match) => match[0].trim())
    .slice(0, 3);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
