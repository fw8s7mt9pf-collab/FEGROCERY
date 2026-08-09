import { describe, expect, it, vi } from "vitest";
import { enrichCandidatesWithOcrSpace, readOcrSpaceApiKey } from "./ocrSpace";

const candidate = {
  id: "flyer",
  supermarket: "Krolow",
  sourceUrl: "https://example.com",
  imageUrl: "https://example.com/flyer.jpg",
  discoveredAt: "2026-08-01T00:00:00.000Z",
};

describe("OCR.Space", () => {
  it("skips all calls when the API key is missing", async () => {
    const result = await enrichCandidatesWithOcrSpace([candidate], { apiKey: undefined });
    expect(result.candidates).toEqual([candidate]);
    expect(result.stats).toMatchObject({ provider: "ocr.space", enabled: false, skipped: 1, attempted: 0 });
  });

  it("reads the API key from the expected environment variable", () => {
    expect(readOcrSpaceApiKey({ OCR_SPACE_API_KEY: " free-key " })).toBe("free-key");
    expect(readOcrSpaceApiKey({ OCR_SPACE_API_KEY: " " })).toBeUndefined();
  });

  it("adds Portuguese OCR text while preserving the candidate", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ParsedResults: [{ ParsedText: "Ofertas validas de 01/08 ate 02/08/2026" }] }), { status: 200 }),
    );
    const result = await enrichCandidatesWithOcrSpace([candidate], { apiKey: "free-key", fetcher });
    expect(result.candidates[0].visionText).toContain("Ofertas validas");
    expect(result.stats).toMatchObject({ attempted: 1, succeeded: 1, failed: 0 });
    expect(fetcher).toHaveBeenCalledWith("https://api.ocr.space/parse/image", expect.objectContaining({ method: "POST" }));
  });

  it("keeps the flyer when OCR.Space reports a processing error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ IsErroredOnProcessing: true, ErrorMessage: ["rate limit reached"] }), { status: 200 }),
    );
    const result = await enrichCandidatesWithOcrSpace([candidate], { apiKey: "free-key", fetcher });
    expect(result.candidates).toEqual([candidate]);
    expect(result.stats.errors[0]).toContain("rate limit reached");
  });
});
