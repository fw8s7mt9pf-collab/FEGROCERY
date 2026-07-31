import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractDealsFromCandidates } from "../src/flyerExtraction";
import type { SourceCandidate } from "../src/sourceCandidates";

type RawCandidatePayload = {
  candidates: SourceCandidate[];
};

const inputPath = "public/data/raw-candidates.json";
const dealsOutputPath = "public/data/deals.json";
const debugOutputPath = "public/data/extraction-debug.json";

async function main(): Promise<void> {
  const payload = JSON.parse(await readFile(inputPath, "utf8")) as RawCandidatePayload;
  const refreshedAt = new Date();
  const result = extractDealsFromCandidates(payload.candidates, refreshedAt);

  await mkdir(dirname(dealsOutputPath), { recursive: true });
  await writeFile(dealsOutputPath, `${JSON.stringify(result.deals, null, 2)}\n`, "utf8");
  await writeFile(
    debugOutputPath,
    `${JSON.stringify({ generatedAt: refreshedAt.toISOString(), warnings: result.warnings }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Wrote ${result.deals.length} deals to ${dealsOutputPath}`);
  if (result.warnings.length) {
    console.warn(`Extraction warnings: ${result.warnings.length}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
