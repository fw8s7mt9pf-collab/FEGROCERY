import { describe, expect, it, vi } from "vitest";
import { enrichCandidatesWithAiParsedListings } from "./flyerAiParser";

const candidate = {
  id: "flyer",
  supermarket: "Krolow",
  sourceUrl: "https://example.com",
  imageUrl: "https://example.com/flyer.avif",
  discoveredAt: "2026-08-01T00:00:00.000Z",
  visionText: "Ofertas validas de 01/08 ate 02/08/2026. Bife R$ 29,90.",
};

describe("AI flyer parser", () => {
  it("skips all calls when the API key is missing", async () => {
    const result = await enrichCandidatesWithAiParsedListings([candidate], { apiKey: undefined });
    expect(result.candidates).toEqual([candidate]);
    expect(result.stats).toMatchObject({ provider: "mistral-chat", enabled: false, skipped: 1, attempted: 0 });
  });

  it("sends OCR text to Mistral chat and preserves structured listing data", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Ofertas de carnes Krolow",
                  category: "Meats",
                  validFrom: "2026-08-01T00:00:00-03:00",
                  validUntil: "2026-08-02T23:59:59-03:00",
                  summary: "Carnes em oferta.",
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await enrichCandidatesWithAiParsedListings([candidate], {
      apiKey: "test-key",
      fetcher,
      referenceDate: new Date("2026-08-01T12:00:00.000Z"),
    });

    expect(result.candidates[0].parsedListing).toMatchObject({
      title: "Ofertas de carnes Krolow",
      category: "Meats",
      validFrom: "2026-08-01T03:00:00.000Z",
      validUntil: "2026-08-03T02:59:59.000Z",
    });
    expect(result.stats).toMatchObject({ attempted: 1, succeeded: 1, failed: 0 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.mistral.ai/v1/chat/completions",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ authorization: "Bearer test-key" }) }),
    );
  });

  it("keeps the flyer when Mistral chat returns invalid data", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }), { status: 200 }));

    const result = await enrichCandidatesWithAiParsedListings([candidate], { apiKey: "test-key", fetcher });

    expect(result.candidates).toEqual([candidate]);
    expect(result.stats.errors[0]).toContain("Unexpected token");
  });
});
