import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  collectGrupoRoxoCandidates,
  collectKrolowCandidates,
  collectMercadoPradoCandidates,
  retainMissingSources,
  type ApifyInstagramPost,
  type CollectorResult,
  type SourceCandidate,
} from "../src/sourceCandidates";

type WordpressPage = {
  content?: {
    rendered?: string;
  };
};

type ApifyRun = {
  data?: {
    id?: string;
    status?: string;
    defaultDatasetId?: string;
  };
};

const outputPath = "public/data/raw-candidates.json";
const mercadoPradoProfileUrl = "https://www.instagram.com/sigamercadoprado/";
const sourceSupermarkets = ["Grupo Roxo", "Krolow", "Mercado Prado"];

async function main(): Promise<void> {
  const discoveredAt = new Date().toISOString();
  const results = await Promise.allSettled([
    collectGrupoRoxo(discoveredAt),
    collectKrolow(discoveredAt),
    collectMercadoPrado(discoveredAt),
  ]);

  const candidates = results.flatMap((result) => (result.status === "fulfilled" ? result.value.candidates : []));
  const skipped = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.skipped : [`Collector failed: ${result.reason}`],
  );
  const previous = await readPreviousCandidates();
  const publishedCandidates = retainMissingSources(candidates, previous, sourceSupermarkets);
  const retainedSupermarkets = sourceSupermarkets.filter(
    (supermarket) =>
      !candidates.some((candidate) => candidate.supermarket === supermarket) &&
      previous.some((candidate) => candidate.supermarket === supermarket),
  );
  if (retainedSupermarkets.length) {
    skipped.push(`Reused previous candidates for: ${retainedSupermarkets.join(", ")}.`);
  }

  const payload = {
    generatedAt: discoveredAt,
    candidates: publishedCandidates,
    skipped,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${publishedCandidates.length} candidates to ${outputPath}`);
  if (skipped.length) {
    console.warn(`Skipped ${skipped.length} items`);
  }
}

async function readPreviousCandidates(): Promise<SourceCandidate[]> {
  try {
    const payload = JSON.parse(await readFile(outputPath, "utf8")) as { candidates?: SourceCandidate[] };
    return payload.candidates ?? [];
  } catch {
    return [];
  }
}

async function collectGrupoRoxo(discoveredAt: string): Promise<CollectorResult> {
  const page = await fetchJson<WordpressPage>("https://www.gruporoxo.com.br/wp-json/wp/v2/pages/62");
  return collectGrupoRoxoCandidates(page.content?.rendered ?? "", discoveredAt);
}

async function collectKrolow(discoveredAt: string): Promise<CollectorResult> {
  try {
    const pages = await fetchJson<WordpressPage[]>("https://macroatacadokrolow.com.br/wp-json/wp/v2/pages?slug=home");
    return collectKrolowCandidates(pages[0]?.content?.rendered ?? "", discoveredAt);
  } catch {
    const html = await fetchText("https://macroatacadokrolow.com.br/");
    const result = collectKrolowCandidates(html, discoveredAt);
    return { ...result, skipped: ["Krolow WordPress API failed; used homepage HTML fallback.", ...result.skipped] };
  }
}

async function collectMercadoPrado(discoveredAt: string): Promise<CollectorResult> {
  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) throw new Error("Mercado Prado requires the APIFY_TOKEN secret");

  const run = await startApifyInstagramRun(token);
  const finishedRun = await waitForApifyRun(run, token);
  const datasetId = finishedRun.data?.defaultDatasetId;
  if (!datasetId) throw new Error("Apify Instagram Scraper finished without a dataset");

  const posts = await fetchApifyJson<ApifyInstagramPost[]>(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
    token,
  );
  return collectMercadoPradoCandidates(posts, discoveredAt);
}

async function startApifyInstagramRun(token: string): Promise<ApifyRun> {
  return fetchApifyJson<ApifyRun>(
    "https://api.apify.com/v2/actors/apify~instagram-scraper/runs?waitForFinish=60&maxItems=30&maxTotalChargeUsd=0.25",
    token,
    {
      method: "POST",
      body: JSON.stringify({
        directUrls: [mercadoPradoProfileUrl],
        resultsType: "posts",
        resultsLimit: 30,
        onlyPostsNewerThan: "7 days",
      }),
    },
  );
}

async function waitForApifyRun(initialRun: ApifyRun, token: string): Promise<ApifyRun> {
  let run = initialRun;
  const runId = run.data?.id;
  if (!runId) throw new Error("Apify Instagram Scraper did not return a run ID");

  const deadline = Date.now() + 10 * 60 * 1_000;
  while (!isTerminalApifyStatus(run.data?.status)) {
    if (Date.now() >= deadline) throw new Error(`Apify Instagram Scraper run ${runId} timed out`);
    run = await fetchApifyJson<ApifyRun>(
      `https://api.apify.com/v2/actor-runs/${runId}?waitForFinish=60`,
      token,
    );
  }

  if (run.data?.status !== "SUCCEEDED") {
    throw new Error(`Apify Instagram Scraper run ${runId} ended with status ${run.data?.status ?? "UNKNOWN"}`);
  }
  return run;
}

function isTerminalApifyStatus(status?: string): boolean {
  return ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(status ?? "");
}

async function fetchApifyJson<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "FEGROCERY/0.1 (+https://github.com/fw8s7mt9pf-collab/FEGROCERY)",
      ...init.headers,
    },
    signal: AbortSignal.timeout(70_000),
  });
  if (!response.ok) throw new Error(`Apify API returned ${response.status} for ${response.url}`);
  return response.json() as Promise<T>;
}

async function fetchJson<T>(url: string, extraHeaders: Record<string, string> = {}): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "FEGROCERY/0.1 (+https://github.com/fw8s7mt9pf-collab/FEGROCERY)",
          ...extraHeaders,
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

async function fetchText(url: string): Promise<string> {
  const response = await fetchWithRetry(url);
  return response.text();
}

async function fetchWithRetry(url: string): Promise<Response> {
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
      return response;
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
