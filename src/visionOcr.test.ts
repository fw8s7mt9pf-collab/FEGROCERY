import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { enrichCandidatesWithVision, readVisionCredentials } from "./visionOcr";

const candidate = { id: "flyer", supermarket: "Krolow", sourceUrl: "https://example.com", imageUrl: "https://example.com/flyer.jpg", discoveredAt: "2026-08-01T00:00:00.000Z" };

describe("vision OCR", () => {
  it("skips all calls when credentials are missing", async () => {
    const result = await enrichCandidatesWithVision([candidate], { credentials: undefined });
    expect(result.candidates).toEqual([candidate]);
    expect(result.stats).toMatchObject({ enabled: false, skipped: 1, attempted: 0 });
  });

  it("parses credentials without exposing the private key in diagnostics", () => {
    expect(readVisionCredentials({ GOOGLE_CLOUD_CREDENTIALS_JSON: JSON.stringify({ client_email: "bot@example.com", private_key: "secret" }) })).toEqual({ client_email: "bot@example.com", private_key: "secret" });
    expect(readVisionCredentials({ GOOGLE_CLOUD_CREDENTIALS_JSON: "invalid" })).toBeUndefined();
  });

  it("adds OCR text while preserving the candidate", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }));
    fetcher.mockResolvedValueOnce(new Response("image", { status: 200 }));
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ responses: [{ fullTextAnnotation: { text: "Ofertas validas de 01/08 ate 02/08/2026" } }] }), { status: 200 }));
    const result = await enrichCandidatesWithVision([candidate], { credentials: { client_email: "bot@example.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }, fetcher });
    expect(result.candidates[0].visionText).toContain("Ofertas validas");
    expect(result.stats).toMatchObject({ attempted: 1, succeeded: 1, failed: 0 });
  });
});
