import { describe, expect, it } from "vitest";
import { classifyCategory, extractDealsFromCandidates, fallbackDateCaptionPatterns, getVisibleDeals, parseValidityDates } from "./flyerExtraction";
import { collectKrolowCandidates, type SourceCandidate } from "./sourceCandidates";

const refreshedAt = new Date("2026-07-31T15:00:00.000Z");

describe("classifyCategory", () => {
  it("classifies meat and produce flyer text into the fixed categories", () => {
    expect(classifyCategory("Bife de ancho, costela bovina e frango congelado")).toBe("Meats");
    expect(classifyCategory("Ofertas do Hortifruti com banana e tomate")).toBe("Produce");
  });
});

describe("parseValidityDates", () => {
  it("documents at least twelve fallback caption patterns", () => {
    expect(fallbackDateCaptionPatterns.length).toBeGreaterThanOrEqual(12);
  });

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

  it("extracts month-name ranges using the Portuguese à separator", () => {
    expect(parseValidityDates("Ofertas válidas para os dias 7 à 9 de agosto", refreshedAt)).toEqual({
      validFrom: new Date("2026-08-07T03:00:00.000Z"),
      validUntil: new Date("2026-08-10T02:59:59.000Z"),
    });
  });

  it("extracts a bare month-name range returned by Mistral from a flyer banner", () => {
    expect(parseValidityDates("UMA VIDA COM VOCÊ 6 À 9 DE AGOSTO enquanto durarem os estoques", refreshedAt)).toEqual({
      validFrom: new Date("2026-08-06T03:00:00.000Z"),
      validUntil: new Date("2026-08-10T02:59:59.000Z"),
    });
  });

  it("extracts common OCR fallback date captions", () => {
    const cases = [
      ["Validade 01/08 a 02/08", "2026-08-03T02:59:59.000Z"],
      ["De 01/08 ate 02/08", "2026-08-03T02:59:59.000Z"],
      ["01/08 - 02/08", "2026-08-03T02:59:59.000Z"],
      ["1 de agosto a 2 de agosto", "2026-08-03T02:59:59.000Z"],
      ["De 1 a 2/agosto", "2026-08-03T02:59:59.000Z"],
      ["Valido ate 02/08/2026", "2026-08-03T02:59:59.000Z"],
      ["Ate 2 de agosto", "2026-08-03T02:59:59.000Z"],
      ["Somente dia 02/08", "2026-08-03T02:59:59.000Z"],
      ["Somente hoje", "2026-08-01T02:59:59.000Z"],
      ["Hoje e amanha", "2026-08-02T02:59:59.000Z"],
    ] as const;

    for (const [caption, validUntil] of cases) {
      expect(parseValidityDates(caption, refreshedAt).validUntil?.toISOString()).toBe(validUntil);
    }
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

  it("uses AI parsed listing fields when OCR text was structured by the parser", () => {
    const result = extractDealsFromCandidates(
      [
        {
          id: "parsed",
          supermarket: "Krolow",
          sourceUrl: "https://macroatacadokrolow.com.br/",
          imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/flyer.jpeg",
          discoveredAt: refreshedAt.toISOString(),
          visionText: "Oferta geral R$ 1,99",
          parsedListing: {
            category: "Meats",
            productCount: 3,
            productNames: ["Bife de ancho", "Costela bovina", "Frango inteiro"],
            hasMoreThanThreeProducts: false,
            validFrom: "2026-08-01T03:00:00.000Z",
            validUntil: "2026-08-03T02:59:59.000Z",
          },
        },
      ],
      refreshedAt,
    );

    expect(result.deals[0]).toMatchObject({
      title: "Bife de ancho, Costela bovina, Frango inteiro",
      category: "Meats",
      validFrom: "2026-08-01T03:00:00.000Z",
      validUntil: "2026-08-03T02:59:59.000Z",
      warning: undefined,
    });
  });

  it("uses the flyer category as the title when more than three products are shown", () => {
    const result = extractDealsFromCandidates(
      [
        {
          id: "dense-produce",
          supermarket: "Krolow",
          sourceUrl: "https://macroatacadokrolow.com.br/",
          imageUrl: "https://macroatacadokrolow.com.br/flyer.avif",
          discoveredAt: refreshedAt.toISOString(),
          rawTitle: "Ofertas Krolow",
          parsedListing: {
            category: "Produce",
            productCount: 8,
            productNames: [],
            hasMoreThanThreeProducts: true,
          },
        },
      ],
      refreshedAt,
    );

    expect(result.deals[0].title).toBe("Hortifruti");
  });

  it("keeps a collected Krolow AVIF flyer visible with its real OCR shape", () => {
    const [candidate] = collectKrolowCandidates(
      '<h2>Ofertas Especiais <br>Feitas Para Você!</h2><img src="https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908.avif"><p>Verifique a data de validade das ofertas!</p>',
      "2026-08-01T10:00:00.000Z",
    ).candidates;
    const result = extractDealsFromCandidates(
      [
        {
          ...candidate,
          visionText:
            "E BOM FAZER PARTE DA SUA VIDA! Tricard mais 1234 567A 9A7L 5432 0000 DESDE VALIDADE 00/00 00/00 GABRIEL LINS MOLINA KROLOW",
        },
      ],
      refreshedAt,
    );

    expect(result.currentDeals[0]).toMatchObject({
      supermarket: "Krolow",
      title: "Ofertas Krolow",
      imageUrl: "https://macroatacadokrolow.com.br/wp-content/uploads/2026/08/DIAK-0708-ate-0908.avif",
    });
  });

  it("excludes non-offer images without a price, promotion text, or validity date", () => {
    const result = extractDealsFromCandidates(
      [
        {
          id: "krolow-card",
          supermarket: "Krolow",
          sourceUrl: "https://macroatacadokrolow.com.br/",
          imageUrl: "https://macroatacadokrolow.com.br/card.jpg",
          discoveredAt: refreshedAt.toISOString(),
          visionText: "Parcele suas compras em 6x sem juros",
        },
      ],
      refreshedAt,
    );

    expect(result.currentDeals).toEqual([]);
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
