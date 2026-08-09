import { categories, type Category, type Deal } from "./deals";
import type { SourceCandidate } from "./sourceCandidates";

export type ExtractionInput = SourceCandidate & {
  visionText?: string;
  parsedListing?: {
    title?: string;
    category?: Category;
    validFrom?: string;
    validUntil?: string;
    productNames?: string[];
    productCount?: number;
    hasMoreThanThreeProducts?: boolean;
  };
};

export type ExtractionResult = {
  deals: Deal[];
  currentDeals: Deal[];
  expiredDeals: Deal[];
  warnings: string[];
};

const categoryTerms: Array<{ category: Category; terms: string[] }> = [
  { category: "Meats", terms: ["carne", "carnes", "bovina", "suino", "frango", "linguica", "costela", "bife", "pernil"] },
  { category: "Produce", terms: ["hortifruti", "fruta", "frutas", "verdura", "verduras", "legume", "legumes", "banana", "tomate"] },
  { category: "Basic Groceries", terms: ["cesta", "arroz", "feijao", "oleo", "acucar", "mercearia", "basica"] },
  { category: "Cleaning", terms: ["limpeza", "detergente", "sabao", "amaciante", "desinfetante"] },
  { category: "Hygiene", terms: ["higiene", "shampoo", "sabonete", "creme dental", "papel higienico"] },
  { category: "Beverages", terms: ["bebida", "bebidas", "refrigerante", "cerveja", "suco", "agua"] },
  { category: "Bakery", terms: ["padaria", "pao", "bolo", "cuca"] },
  { category: "Frozen", terms: ["congelado", "congelada", "congelados", "frozen"] },
];

const categoryTitles: Record<Category, string> = {
  Meats: "Carnes",
  Produce: "Hortifruti",
  "Basic Groceries": "Mercearia",
  Cleaning: "Limpeza",
  Hygiene: "Higiene",
  Beverages: "Bebidas",
  Bakery: "Padaria",
  Frozen: "Congelados",
  Other: "Ofertas variadas",
};

export const fallbackDateCaptionPatterns = [
  "Ofertas validas de DD/MM ate DD/MM/YYYY",
  "Validade DD/MM a DD/MM",
  "De DD/MM ate DD/MM",
  "DD/MM - DD/MM",
  "DD a DD de mes",
  "Dias DD e DD de mes",
  "DD de mes a DD de mes",
  "De DD a DD/mes",
  "Valido ate DD/MM/YYYY",
  "Ate DD de mes",
  "Somente dia DD/MM",
  "Somente hoje",
  "Hoje e amanha",
] as const;

export function extractDealsFromCandidates(inputs: ExtractionInput[], refreshedAt: Date): ExtractionResult {
  const warnings: string[] = [];
  const deals = inputs.flatMap((input) => {
    const text = candidateText(input);
    const category = input.parsedListing?.category ?? classifyCategory(text);
    const parsedDates = parsedListingDates(input) ?? parseValidityDates(text, refreshedAt);
    if (!isOfferCandidate(text, parsedDates)) return [];
    const warningParts: string[] = [];

    if (category === "Other") {
      warningParts.push("Categoria inferida com baixa confianca.");
    }

    if (!parsedDates.validUntil) {
      warningParts.push("Validade nao encontrada; oferta expira automaticamente em 48 horas.");
    }

    const deal: Deal = {
      id: input.id,
      supermarket: input.supermarket,
      category,
      title: titleFor(input, category),
      imageUrl: input.imageUrl,
      sourceUrl: input.sourceUrl,
      validFrom: parsedDates.validFrom?.toISOString(),
      validUntil: parsedDates.validUntil?.toISOString(),
      expiresAt: (parsedDates.validUntil ?? addHours(new Date(input.discoveredAt), 48)).toISOString(),
      lastRefreshed: refreshedAt.toISOString(),
      warning: warningParts.length ? warningParts.join(" ") : undefined,
    };

    if (deal.warning) {
      warnings.push(`${deal.id}: ${deal.warning}`);
    }

    return [deal];
  });

  const currentDeals = getVisibleDeals(deals, refreshedAt);
  const expiredDeals = deals.filter((deal) => !currentDeals.includes(deal));

  return { deals, currentDeals, expiredDeals, warnings };
}

function isOfferCandidate(text: string, dates: { validFrom?: Date; validUntil?: Date }): boolean {
  const normalized = normalizeText(repairMojibake(text));
  return Boolean(dates.validUntil) || /ofertas?|promoc|r\$\s*\d|preco/i.test(normalized);
}

export function getVisibleDeals(deals: Deal[], now: Date): Deal[] {
  return deals.filter((deal) => new Date(deal.expiresAt) >= now);
}

export function classifyCategory(text: string): Category {
  const normalized = normalizeText(repairMojibake(text));
  for (const { category, terms } of categoryTerms) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) {
      return category;
    }
  }
  return "Other";
}

export function parseValidityDates(text: string, referenceDate: Date): { validFrom?: Date; validUntil?: Date } {
  const normalized = normalizeText(repairMojibake(text)).replace(/\s+/g, " ");

  const explicitRange = normalized.match(/(?:validas?|validade|ofertas validas?)\D{0,20}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\D{0,20}(?:ate|a)\D{0,10}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (explicitRange) return numericRangeDates(explicitRange, referenceDate);

  const numericRange = normalized.match(/\b(?:validade|validas?|de|dias?)?\D{0,12}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\s*(?:-|a|ate|e)\s*(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (numericRange) return numericRangeDates(numericRange, referenceDate);

  const days = normalized.match(/(?:dias?|valido dias?)\D{0,10}(\d{1,2})\D{1,8}(?:e|a|ate)\D{0,8}(\d{1,2})(?:\s+de)?\s+([a-z]+)/i);
  if (days) return sameMonthRangeDates(days[1], days[2], days[3], referenceDate);

  const monthToMonth = normalized.match(/\b(\d{1,2})(?:\s+de)?\s+([a-z]+)\s*(?:a|ate|-)\s*(\d{1,2})(?:\s+de)?\s+([a-z]+)/i);
  if (monthToMonth) {
    const fromMonth = monthNumber(monthToMonth[2]);
    const untilMonth = monthNumber(monthToMonth[4]);
    if (fromMonth && untilMonth) {
      return {
        validFrom: dateInBrazil(Number(monthToMonth[1]), fromMonth, referenceDate.getUTCFullYear()),
        validUntil: endOfDay(dateInBrazil(Number(monthToMonth[3]), untilMonth, referenceDate.getUTCFullYear())),
      };
    }
  }

  const bareDays = normalized.match(/\b(?:de\s*)?(\d{1,2})\s*(?:e|a|ate|-)\s*(\d{1,2})\s*(?:de\s+|\/\s*)?([a-z]+)/i);
  if (bareDays) return sameMonthRangeDates(bareDays[1], bareDays[2], bareDays[3], referenceDate);

  const untilNumeric = normalized.match(/\b(?:validade|validas?|valido|ate|somente dia|dia)\D{0,20}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (untilNumeric) {
    const date = dateInBrazil(Number(untilNumeric[1]), Number(untilNumeric[2]), yearFrom(untilNumeric[3], referenceDate));
    return { validUntil: endOfDay(date) };
  }

  const untilMonthName = normalized.match(/\b(?:validade|validas?|valido|ate|somente dia|dia)\D{0,20}(\d{1,2})(?:\s+de)?\s+([a-z]+)/i);
  if (untilMonthName) {
    const month = monthNumber(untilMonthName[2]);
    if (month) return { validUntil: endOfDay(dateInBrazil(Number(untilMonthName[1]), month, referenceDate.getUTCFullYear())) };
  }

  if (/\bhoje\s*(?:e|a|ate)\s*amanha\b/i.test(normalized)) {
    const today = startOfReferenceDay(referenceDate);
    return { validFrom: today, validUntil: endOfDay(addDays(today, 1)) };
  }

  if (/\b(?:somente\s+)?hoje\b/i.test(normalized)) {
    const today = startOfReferenceDay(referenceDate);
    return { validFrom: today, validUntil: endOfDay(today) };
  }

  return {};
}

function candidateText(input: ExtractionInput): string {
  return [input.rawTitle, input.rawCaption, input.visionText]
    .filter((value): value is string => Boolean(value))
    .map((value) => repairMojibake(value))
    .join("\n");
}

function titleFor(input: ExtractionInput, category: Category): string {
  const productNames = input.parsedListing?.productNames?.map(repairMojibake).filter(Boolean) ?? [];
  const productCount = input.parsedListing?.productCount ?? productNames.length;
  if (input.parsedListing?.hasMoreThanThreeProducts || productCount > 3 || productNames.length > 3) {
    return categoryTitles[category];
  }
  if (productNames.length) return productNames.join(", ").slice(0, 90);
  if (input.parsedListing?.productCount !== undefined) return categoryTitles[category];
  if (input.parsedListing?.title) return repairMojibake(input.parsedListing.title).slice(0, 90);
  if (input.supermarket === "Krolow" || input.supermarket === "Mercado Prado") return categoryTitles[category];
  const raw = input.rawTitle || input.rawCaption;
  if (raw) return repairMojibake(raw).split("\n")[0].slice(0, 90);
  return `${input.supermarket} - ${categories.includes(category) ? category : "Oferta"}`;
}

function parsedListingDates(input: ExtractionInput): { validFrom?: Date; validUntil?: Date } | undefined {
  const validFrom = dateFromIso(input.parsedListing?.validFrom);
  const validUntil = dateFromIso(input.parsedListing?.validUntil);
  if (!validFrom && !validUntil) return undefined;
  return { validFrom, validUntil };
}

function dateFromIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function numericRangeDates(match: RegExpMatchArray, referenceDate: Date): { validFrom?: Date; validUntil?: Date } {
  const from = dateInBrazil(Number(match[1]), Number(match[2]), yearFrom(match[3], referenceDate));
  const until = endOfDay(dateInBrazil(Number(match[4]), Number(match[5]), yearFrom(match[6] ?? match[3], referenceDate)));
  return { validFrom: from, validUntil: until };
}

function sameMonthRangeDates(fromDay: string, untilDay: string, monthName: string, referenceDate: Date): { validFrom?: Date; validUntil?: Date } {
  const month = monthNumber(monthName);
  if (!month) return {};
  return {
    validFrom: dateInBrazil(Number(fromDay), month, referenceDate.getUTCFullYear()),
    validUntil: endOfDay(dateInBrazil(Number(untilDay), month, referenceDate.getUTCFullYear())),
  };
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function dateInBrazil(day: number, month: number, year: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 26, 59, 59));
}

function startOfReferenceDay(date: Date): Date {
  return dateInBrazil(date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function yearFrom(value: string | undefined, referenceDate: Date): number {
  if (!value) return referenceDate.getUTCFullYear();
  const parsed = Number(value);
  return parsed < 100 ? 2000 + parsed : parsed;
}

function monthNumber(value: string): number | undefined {
  const key = normalizeText(value);
  return {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  }[key];
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function repairMojibake(value: string): string {
  if (!/[ÃƒÃ‚Ã°]/.test(value)) return value;
  return new TextDecoder("utf-8").decode(Uint8Array.from([...value].map(windows1252Byte)));
}

function windows1252Byte(char: string): number {
  const code = char.charCodeAt(0);
  const mapped = windows1252ReverseMap[code];
  return mapped ?? code;
}

const windows1252ReverseMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};
