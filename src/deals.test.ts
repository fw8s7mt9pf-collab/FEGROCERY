import { describe, expect, it } from "vitest";
import { getCurrentDeals, getSupermarkets, type Deal } from "./deals";

const deals: Deal[] = [
  {
    id: "current-meat",
    supermarket: "Krolow",
    category: "Meats",
    title: "Carnes da semana",
    imageUrl: "/sample/krolow.jpg",
    sourceUrl: "https://macroatacadokrolow.com.br/",
    expiresAt: "2026-08-02T23:59:59-03:00",
    lastRefreshed: "2026-07-31T12:00:00-03:00",
  },
  {
    id: "expired-produce",
    supermarket: "Roxo",
    category: "Produce",
    title: "Hortifruti",
    imageUrl: "/sample/roxo.jpg",
    sourceUrl: "https://www.gruporoxo.com.br/promocoes/",
    expiresAt: "2026-07-20T23:59:59-03:00",
    lastRefreshed: "2026-07-19T12:00:00-03:00",
  },
  {
    id: "current-basic",
    supermarket: "Roxo",
    category: "Basic Groceries",
    title: "Cesta basica",
    imageUrl: "/sample/roxo-basic.jpg",
    sourceUrl: "https://www.gruporoxo.com.br/promocoes/",
    expiresAt: "2026-08-03T23:59:59-03:00",
    lastRefreshed: "2026-07-31T12:00:00-03:00",
  },
];

describe("getCurrentDeals", () => {
  it("hides expired flyers from the current public view", () => {
    expect(
      getCurrentDeals(deals, {
        category: "All",
        supermarket: "All",
        now: new Date("2026-07-31T12:00:00-03:00"),
      }).map((deal) => deal.id),
    ).toEqual(["current-meat", "current-basic"]);
  });

  it("filters current flyers by category and supermarket", () => {
    expect(
      getCurrentDeals(deals, {
        category: "Basic Groceries",
        supermarket: "Roxo",
        now: new Date("2026-07-31T12:00:00-03:00"),
      }).map((deal) => deal.id),
    ).toEqual(["current-basic"]);
  });
});

describe("getSupermarkets", () => {
  it("returns unique supermarkets in display order", () => {
    expect(getSupermarkets(deals)).toEqual(["Krolow", "Roxo"]);
  });
});
