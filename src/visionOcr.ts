import { createSign } from "node:crypto";
import type { SourceCandidate } from "./sourceCandidates";

export type OcrStats = {
  provider: "google-cloud-vision";
  enabled: boolean;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
};

type VisionCredentials = { client_email: string; private_key: string };
type VisionResponse = { responses?: Array<{ fullTextAnnotation?: { text?: string }; error?: { message?: string } }> };

export function readVisionCredentials(env: NodeJS.ProcessEnv = process.env): VisionCredentials | undefined {
  const raw = env.GOOGLE_CLOUD_CREDENTIALS_JSON?.trim();
  if (!raw) return undefined;
  try {
    const credentials = JSON.parse(raw) as Partial<VisionCredentials>;
    if (!credentials.client_email || !credentials.private_key) return undefined;
    return { client_email: credentials.client_email, private_key: credentials.private_key };
  } catch {
    return undefined;
  }
}

export function createVisionStats(enabled: boolean): OcrStats {
  return { provider: "google-cloud-vision", enabled, attempted: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
}

export async function enrichCandidatesWithVision(
  candidates: SourceCandidate[],
  options: { credentials?: VisionCredentials; fetcher?: typeof fetch } = {},
): Promise<{ candidates: Array<SourceCandidate & { visionText?: string }>; stats: OcrStats }> {
  const credentials = options.credentials;
  const stats = createVisionStats(Boolean(credentials));
  if (!credentials) {
    stats.skipped = candidates.length;
    return { candidates, stats };
  }

  const fetcher = options.fetcher ?? fetch;
  let token: string;
  try {
    token = await getAccessToken(credentials, fetcher);
  } catch (error) {
    stats.failed = candidates.length;
    stats.errors.push(`authentication: ${error instanceof Error ? error.message : "unknown authentication error"}`);
    return { candidates, stats };
  }
  const enriched: Array<SourceCandidate & { visionText?: string }> = [];
  for (const candidate of candidates) {
    stats.attempted += 1;
    try {
      const image = await fetcher(candidate.imageUrl);
      if (!image.ok) throw new Error(`image fetch returned ${image.status}`);
      const content = Buffer.from(await image.arrayBuffer()).toString("base64");
      const response = await fetcher("https://vision.googleapis.com/v1/images:annotate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }),
      });
      if (!response.ok) throw new Error(`Vision API returned ${response.status}`);
      const payload = (await response.json()) as VisionResponse;
      const result = payload.responses?.[0];
      if (result?.error?.message) throw new Error(result.error.message);
      enriched.push({ ...candidate, visionText: result?.fullTextAnnotation?.text ?? "" });
      stats.succeeded += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push(`${candidate.id}: ${error instanceof Error ? error.message : "unknown OCR error"}`);
      enriched.push(candidate);
    }
  }
  return { candidates: enriched, stats };
}

async function getAccessToken(credentials: VisionCredentials, fetcher: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const assertion = `${header}.${claim}.${base64url(signer.sign(credentials.private_key))}`;
  const response = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  if (!response.ok) throw new Error(`Google token request returned ${response.status}`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Google token response did not contain an access token");
  return payload.access_token;
}

function base64url(value: string | Uint8Array): string {
  return Buffer.from(value).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
