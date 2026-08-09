import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractDealsFromCandidates } from "../src/flyerExtraction";
import type { SourceCandidate } from "../src/sourceCandidates";
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
  const ocr = await enrichCandidatesWithMistralOcr(payload.candidates, { apiKey: readMistralApiKey() });
  const result = extractDealsFromCandidates(ocr.candidates, refreshedAt);

  await mkdir(dirname(dealsOutputPath), { recursive: true });
  await writeFile(dealsOutputPath, `${JSON.stringify(result.currentDeals, null, 2)}\n`, "utf8");
  await writeFile(expiredDealsOutputPath, `${JSON.stringify(result.expiredDeals, null, 2)}\n`, "utf8");
  await writeFile(
    debugOutputPath,
    `${JSON.stringify({ generatedAt: refreshedAt.toISOString(), warnings: result.warnings }, null, 2)}\n`,
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
