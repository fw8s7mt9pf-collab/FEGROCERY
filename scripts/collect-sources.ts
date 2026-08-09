import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { collectGrupoRoxoCandidates, collectKrolowCandidates, type CollectorResult } from "../src/sourceCandidates";

type WordpressPage = {
  content?: {
    rendered?: string;
  };
};

const outputPath = "public/data/raw-candidates.json";

async function main(): Promise<void> {
  const discoveredAt = new Date().toISOString();
  const results = await Promise.allSettled([
    collectGrupoRoxo(discoveredAt),
    collectKrolow(discoveredAt),
  ]);

  const candidates = results.flatMap((result) => (result.status === "fulfilled" ? result.value.candidates : []));
  const skipped = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.skipped : [`Collector failed: ${result.reason}`],
  );

  const payload = {
    generatedAt: discoveredAt,
    candidates,
    skipped,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${candidates.length} candidates to ${outputPath}`);
  if (skipped.length) {
    console.warn(`Skipped ${skipped.length} items`);
  }
}

async function collectGrupoRoxo(discoveredAt: string): Promise<CollectorResult> {
  const page = await fetchJson<WordpressPage>("https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62");
  return collectGrupoRoxoCandidates(page.content?.rendered ?? "", discoveredAt);
}

async function collectKrolow(discoveredAt: string): Promise<CollectorResult> {
  const pages = await fetchJson<WordpressPage[]>("https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home");
  return collectKrolowCandidates(pages[0]?.content?.rendered ?? "", discoveredAt);
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "FEGROCERY/0.1 (+https://github.com/fw8s7mt9pf-collab/FEGROCERY)",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
