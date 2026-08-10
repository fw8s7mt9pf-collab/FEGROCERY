import { describe, expect, it, vi } from "vitest";
import { collectMercadoPradoAppCandidates, mercadoPradoDiscountsToCandidates } from "./mercadoPrado";

const discoveredAt = "2026-08-09T18:00:00.000Z";

describe("Mercado Prado club collector", () => {
  it("turns structured offers into candidates that do not require OCR", () => {
    const result = mercadoPradoDiscountsToCandidates(
      [
        {
          id: 42,
          name: "LEITE ELEGE INTEGRAL GARRAFA 1L",
          price: 6.49,
          final_price: 5.49,
          image_url: "https://www.crescevendas.com/system/discounts/42/web/leite.png",
          text_expiration: "Expira em 2 dias",
          active: true,
        },
      ],
      discoveredAt,
    );

    expect(result.candidates).toEqual([
      expect.objectContaining({
        supermarket: "Mercado Prado",
        sourceUrl: "https://clubeamigosdoprado.crescevendas.com/",
        rawTitle: "LEITE ELEGE INTEGRAL GARRAFA 1L",
        rawCaption: expect.stringContaining("R$ 5,49"),
        parsedListing: expect.objectContaining({
          productNames: ["LEITE ELEGE INTEGRAL GARRAFA 1L"],
          productCount: 1,
          validUntil: "2026-08-12T02:59:59.000Z",
        }),
        structuredOffer: {
          regularPrice: 6.49,
          dealPrice: 5.49,
          unitText: undefined,
          limitText: undefined,
        },
      }),
    ]);
  });

  it("resolves relative API image paths against the Cresce Vendas host", () => {
    const result = mercadoPradoDiscountsToCandidates(
      [
        {
          id: 43,
          name: "ARROZ",
          price: 10,
          final_price: 8,
          image_url: "/system/discount_images/files/043/thumb/arroz.png",
          active: true,
        },
      ],
      discoveredAt,
    );

    expect(result.candidates[0]?.imageUrl).toBe(
      "https://www.crescevendas.com/system/discount_images/files/043/thumb/arroz.png",
    );
  });

  it("keeps only offers discounted by strictly more than ten percent", () => {
    const result = mercadoPradoDiscountsToCandidates(
      [
        { id: 1, name: "Above", price: 10, final_price: 8.99, image_url: "https://cdn.example/above.jpg" },
        { id: 2, name: "Exactly", price: 10, final_price: 9, image_url: "https://cdn.example/exactly.jpg" },
        { id: 3, name: "Below", price: 10, final_price: 9.01, image_url: "https://cdn.example/below.jpg" },
        { id: 4, name: "Missing", final_price: 8, image_url: "https://cdn.example/missing.jpg" },
      ],
      discoveredAt,
    );

    expect(result.candidates.map((candidate) => candidate.rawTitle)).toEqual(["Above"]);
  });

  it("logs in with CPF digits, then requests authenticated home offers", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { userLogin: { token: "private-token" } } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              home_carousels: {
                carousels: [
                  {
                    discounts: [
                      {
                        id: "one",
                        name: "Arroz",
                        price: 10,
                        final_price: 8,
                        image_url: "https://cdn.example/arroz.jpg",
                        active: true,
                      },
                    ],
                  },
                ],
              },
            },
          }),
        ),
      );

    const result = await collectMercadoPradoAppCandidates("123.456.789-00", "secret", discoveredAt, fetcher);

    const loginBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(loginBody.variables).toEqual({ registration: "12345678900", password: "secret" });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ authorization: "Bearer private-token" });
    expect(result.candidates).toHaveLength(1);
  });

  it("reports rejected credentials without exposing their values", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { userLogin: { errors: [{ field: "registration" }] } } })),
    );

    await expect(
      collectMercadoPradoAppCandidates("123.456.789-00", "secret", discoveredAt, fetcher),
    ).rejects.toThrow("Mercado Prado login was rejected (registration)");
  });
});
