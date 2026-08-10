export const categories = [
  "Meats",
  "Produce",
  "Basic Groceries",
  "Cleaning",
  "Hygiene",
  "Beverages",
  "Alcohol",
  "Bakery",
  "Frozen",
  "Other",
] as const;

export type Category = (typeof categories)[number];

export type Deal = {
  id: string;
  supermarket: string;
  category: Category;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  validFrom?: string;
  validUntil?: string;
  expiresAt: string;
  lastRefreshed: string;
  regularPrice?: number;
  dealPrice?: number;
  unitText?: string;
  limitText?: string;
  warning?: string;
};

export type DealFilters = {
  category: "All" | Category;
  supermarket: "All" | string;
  now: Date;
};

export function getCurrentDeals(deals: Deal[], filters: DealFilters): Deal[] {
  return deals
    .filter((deal) => new Date(deal.expiresAt) >= filters.now)
    .filter((deal) => (filters.category === "All" ? deal.category !== "Alcohol" : deal.category === filters.category))
    .filter((deal) => filters.supermarket === "All" || deal.supermarket === filters.supermarket)
    .sort((a, b) => {
      const categoryOrder = categories.indexOf(a.category) - categories.indexOf(b.category);
      if (categoryOrder !== 0) return categoryOrder;
      return a.supermarket.localeCompare(b.supermarket);
    });
}

export function getSupermarkets(deals: Deal[]): string[] {
  return [...new Set(deals.map((deal) => deal.supermarket))].sort((a, b) => a.localeCompare(b));
}
