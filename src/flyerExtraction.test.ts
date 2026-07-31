import { describe, expect, it } from "vitest";
import { classifyCategory, extractDealsFromCandidates, getVisibleDeals, parseValidityDates } from "./flyerExtraction";
import type { SourceCandidate } from "./sourceCandidates";

const refreshedAt = new Date("2026-07-31T15:00:00.000Z");

describe("classifyCategory", () => {
  it("classifies meat and produce flyer text into the fixed categories", () => {
    expect(classifyCategory("Bife de ancho, costela bovina e frango congelado")).toBe("Meats");
    expect(classifyCategory("Ofertas do Hortifruti com banana e tomate")).toBe("Produce");
  });
});

describe("parseValidityDates", () => {
  it("extracts numeric Brazilian validity ranges", () => {
    expect(parseValidityDates("Ofertas validas de 31/07 ate 02/08/2026", refreshedAt)).toEqual({
      validFrom: new Date("2026-07-31T03:00:00.000Z"),
      validUntil: new Date("2026-08-03T02:59:59.000Z"),
    });
  });

  it("extracts caption ranges with month names", () => {
    expect(parseValidityDates("Dias 01 e 02 de agosto", refreshedAt).validUntil).toEqual(
      new Date("2026-08-03T02:59:59.000Z"),
    );
  });
});

describe("extractDealsFromCandidates", () => {
  it("keeps dense flyers as one deal and applies extracted metadata", () => {
    const candidates: SourceCandidate[] = [
      {
        id: "krolow-meat",
        supermarket: "Krolow",
        sourceUrl: "https://macroatacadokrolow.com.br/",
        imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/flyer.jpeg",
        discoveredAt: refreshedAt.toISOString(),
        rawCaption: "Bife de Ancho e Costela Bovina. Ofertas válidas de 31/07 até 02/08/2026",
      },
    ];

    expect(extractDealsFromCandidates(candidates, refreshedAt).deals).toMatchObject([
      {
        id: "krolow-meat",
        supermarket: "Krolow",
        category: "Meats",
        imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/flyer.jpeg",
        validFrom: "2026-07-31T03:00:00.000Z",
        validUntil: "2026-08-03T02:59:59.000Z",
        warning: undefined,
      },
    ]);
  });

  it("sets warning metadata and a 48-hour fallback expiry when dates are unclear", () => {
    const result = extractDealsFromCandidates(
      [
        {
          id: "unclear",
          supermarket: "Grupo Roxo",
          sourceUrl: "https://www.instagram.com/p/example/",
          imageUrl: "https://www.gruporoxo.com.br/wp-content/uploads/flyer.jpg",
          discoveredAt: "2026-07-30T10:00:00.000Z",
          rawCaption: "Ofertas imperdiveis",
        },
      ],
      refreshedAt,
    );

    expect(result.deals[0]).toMatchObject({
      category: "Other",
      expiresAt: "2026-08-01T10:00:00.000Z",
    });
    expect(result.deals[0].warning).toContain("Validade nao encontrada");
    expect(result.warnings).toHaveLength(1);
  });

  it("repairs mojibake titles from previously collected raw candidates", () => {
    const result = extractDealsFromCandidates(
      [
        {
          id: "encoded",
          supermarket: "Grupo Roxo",
          sourceUrl: "https://www.instagram.com/p/example/",
          imageUrl: "https://www.gruporoxo.com.br/wp-content/uploads/flyer.jpg",
          discoveredAt: refreshedAt.toISOString(),
          rawTitle: "Ofertas de InÃ­cio de Semana ROXOðŸ’œ",
        },
      ],
      refreshedAt,
    );

    expect(result.deals[0].title).toBe("Ofertas de Início de Semana ROXO💜");
  });
});

describe("getVisibleDeals", () => {
  it("separates public current deals from expired debug records", () => {
    expect(
      getVisibleDeals(
        [
          {
            id: "current",
            supermarket: "Krolow",
            category: "Meats",
            title: "Atual",
            imageUrl: "https://example.com/current.jpg",
            sourceUrl: "https://example.com",
            expiresAt: "2026-08-01T00:00:00.000Z",
            lastRefreshed: refreshedAt.toISOString(),
          },
          {
            id: "expired",
            supermarket: "Krolow",
            category: "Meats",
            title: "Expirada",
            imageUrl: "https://example.com/expired.jpg",
            sourceUrl: "https://example.com",
            expiresAt: "2026-07-01T00:00:00.000Z",
            lastRefreshed: refreshedAt.toISOString(),
          },
        ],
        refreshedAt,
      ).map((deal) => deal.id),
    ).toEqual(["current"]);
  });
});
