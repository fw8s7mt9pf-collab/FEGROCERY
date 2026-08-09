import { describe, expect, it, vi } from "vitest";
import { enrichCandidatesWithMistralOcr, readMistralApiKey } from "./mistralOcr";

const candidate = {
  id: "flyer",
  supermarket: "Krolow",
  sourceUrl: "https://example.com",
  imageUrl: "https://example.com/flyer.avif",
  discoveredAt: "2026-08-01T00:00:00.000Z",
};

describe("Mistral OCR", () => {
  it("skips all calls when the API key is missing", async () => {
    const result = await enrichCandidatesWithMistralOcr([candidate], { apiKey: undefined });
    expect(result.candidates).toEqual([candidate]);
    expect(result.stats).toMatchObject({ provider: "mistral-ocr", enabled: false, skipped: 1, attempted: 0 });
  });

  it("reads the API key from the expected environment variable", () => {
    expect(readMistralApiKey({ MISTRAL_API_KEY: " test-key " })).toBe("test-key");
    expect(readMistralApiKey({ MISTRAL_API_KEY: " " })).toBeUndefined();
  });

  it("sends the public flyer URL to Mistral and preserves the extracted markdown", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pages: [
            {
              markdown: "Ofertas válidas de 01/08 até 02/08/2026",
              blocks: [{ content: "Válidas para os dias 1 a 2 de agosto" }],
              confidence_scores: { average_page_confidence_score: 0.97, minimum_page_confidence_score: 0.81 },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await enrichCandidatesWithMistralOcr([candidate], { apiKey: "test-key", fetcher });

    expect(result.candidates[0].visionText).toContain("Ofertas válidas");
    expect(result.candidates[0].visionText).toContain("Válidas para os dias");
    expect(result.candidates[0].ocrDiagnostics).toMatchObject({ averageConfidence: 0.97, minimumConfidence: 0.81 });
    expect(result.stats).toMatchObject({ attempted: 1, succeeded: 1, failed: 0 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.mistral.ai/v1/ocr",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer test-key" }) }),
    );
  });

  it("keeps the flyer when Mistral reports an error", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ message: "rate limit reached" }), { status: 429 }));

    const result = await enrichCandidatesWithMistralOcr([candidate], { apiKey: "test-key", fetcher });

    expect(result.candidates).toEqual([candidate]);
    expect(result.stats.errors[0]).toContain("429");
  });

  it("downloads and resends an image when Mistral cannot fetch its public URL", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "File could not be fetched from url" }), { status: 400 }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/avif" } }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ pages: [{ markdown: "ARROZ R$ 9,99" }] }), { status: 200 }),
      );

    const result = await enrichCandidatesWithMistralOcr([candidate], { apiKey: "test-key", fetcher });

    expect(result.candidates[0].visionText).toContain("ARROZ");
    expect(result.stats).toMatchObject({ succeeded: 1, failed: 0 });
    expect(fetcher).toHaveBeenNthCalledWith(2, candidate.imageUrl, expect.any(Object));
    const retryBody = JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body)) as { document: { image_url: string } };
    expect(retryBody.document.image_url).toBe("data:image/avif;base64,AQID");
  });
});
