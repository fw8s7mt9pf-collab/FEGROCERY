import { categories, type Category, type Deal } from "./deals";
import type { SourceCandidate } from "./sourceCandidates";

export type ExtractionInput = SourceCandidate & {
  visionText?: string;
};

export type ExtractionResult = {
  deals: Deal[];
  currentDeals: Deal[];
  expiredDeals: Deal[];
  warnings: string[];
};

const categoryTerms: Array<{ category: Category; terms: string[] }> = [
  { category: "Meats", terms: ["carne", "carnes", "bovina", "suino", "suíno", "frango", "linguica", "linguiça", "costela", "bife", "pernil"] },
  { category: "Produce", terms: ["hortifruti", "fruta", "frutas", "verdura", "verduras", "legume", "legumes", "banana", "tomate"] },
  { category: "Basic Groceries", terms: ["cesta", "arroz", "feijao", "feijão", "oleo", "óleo", "acucar", "açúcar", "mercearia", "basica", "básica"] },
  { category: "Cleaning", terms: ["limpeza", "detergente", "sabao", "sabão", "amaciante", "desinfetante"] },
  { category: "Hygiene", terms: ["higiene", "shampoo", "sabonete", "creme dental", "papel higienico", "papel higiênico"] },
  { category: "Beverages", terms: ["bebida", "bebidas", "refrigerante", "cerveja", "suco", "agua", "água"] },
  { category: "Bakery", terms: ["padaria", "pao", "pão", "bolo", "cuca"] },
  { category: "Frozen", terms: ["congelado", "congelada", "congelados", "frozen"] },
];

export function extractDealsFromCandidates(inputs: ExtractionInput[], refreshedAt: Date): ExtractionResult {
  const warnings: string[] = [];
  const deals = inputs.map((input) => {
    const text = candidateText(input);
    const category = classifyCategory(text);
    const parsedDates = parseValidityDates(text, refreshedAt);
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
      expiresAt: (parsedDates.validUntil ?? addHours(refreshedAt, 48)).toISOString(),
      lastRefreshed: refreshedAt.toISOString(),
      warning: warningParts.length ? warningParts.join(" ") : undefined,
    };

    if (deal.warning) {
      warnings.push(`${deal.id}: ${deal.warning}`);
    }

    return deal;
  });

  const currentDeals = getVisibleDeals(deals, refreshedAt);
  const expiredDeals = deals.filter((deal) => !currentDeals.includes(deal));

  return { deals, currentDeals, expiredDeals, warnings };
}

export function getVisibleDeals(deals: Deal[], now: Date): Deal[] {
  return deals.filter((deal) => new Date(deal.expiresAt) >= now);
}

export function classifyCategory(text: string): Category {
  const normalized = normalizeText(text);
  for (const { category, terms } of categoryTerms) {
    if (terms.some((term) => normalized.includes(normalizeText(term)))) {
      return category;
    }
  }
  return "Other";
}

export function parseValidityDates(text: string, referenceDate: Date): { validFrom?: Date; validUntil?: Date } {
  const normalized = text.replace(/\s+/g, " ");
  const range = normalized.match(/(?:validas?|válidas?|validade|ofertas validas?|ofertas válidas?)\D{0,20}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\D{0,20}(?:ate|até|a)\D{0,10}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (range) {
    const from = dateInBrazil(Number(range[1]), Number(range[2]), yearFrom(range[3], referenceDate));
    const until = endOfDay(dateInBrazil(Number(range[4]), Number(range[5]), yearFrom(range[6] ?? range[3], referenceDate)));
    return { validFrom: from, validUntil: until };
  }

  const days = normalized.match(/(?:dias?|válido dias?|valido dias?)\D{0,10}(\d{1,2})\D{1,8}(?:e|a|ate|até)\D{0,8}(\d{1,2})(?:\s+de)?\s+([a-zç]+)/i);
  if (days) {
    const month = monthNumber(days[3]);
    if (month) {
      return {
        validFrom: dateInBrazil(Number(days[1]), month, referenceDate.getUTCFullYear()),
        validUntil: endOfDay(dateInBrazil(Number(days[2]), month, referenceDate.getUTCFullYear())),
      };
    }
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
  const raw = input.rawTitle || input.rawCaption;
  if (raw) return repairMojibake(raw).split("\n")[0].slice(0, 90);
  return `${input.supermarket} - ${categories.includes(category) ? category : "Oferta"}`;
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
  if (!/[ÃÂð]/.test(value)) return value;
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
