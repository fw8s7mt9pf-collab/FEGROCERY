import type { CollectorResult, SourceCandidate } from "./sourceCandidates";
import { stableCandidateId } from "./sourceCandidates";

export type MercadoPradoDiscount = {
  id?: string | number;
  name?: string;
  description?: string;
  price?: string | number;
  final_price?: string | number;
  image_url?: string;
  promotion_text?: string;
  unit_text?: string;
  text_limit?: string;
  text_expiration?: string;
  active?: boolean;
};

type MercadoPradoCarousel = {
  discounts?: MercadoPradoDiscount[];
  carousels?: MercadoPradoCarousel[];
};

type LoginResponse = {
  data?: { userLogin?: { token?: string; errors?: Array<{ field?: string; messages?: string[] }> } };
  errors?: Array<{ message?: string }>;
};

type OffersResponse = {
  data?: { home_carousels?: { carousels?: MercadoPradoCarousel[] } };
  errors?: Array<{ message?: string }>;
};

const portalUrl = "https://clubeamigosdoprado.crescevendas.com/";
const graphQlUrl = "https://www.crescevendas.com/graphql";

const loginMutation = `
  mutation UserLogin($registration: String!, $password: String!) {
    userLogin(input: { registration: $registration, password: $password }) {
      token
      errors { field messages }
    }
  }
`;

const offersQuery = `
  query MercadoPradoOffers {
    home_carousels {
      carousels {
        discounts {
          id
          name
          description
          price
          final_price
          image_url
          promotion_text
          unit_text
          text_limit
          text_expiration
          active
        }
        carousels {
          discounts {
            id
            name
            description
            price
            final_price
            image_url
            promotion_text
            unit_text
            text_limit
            text_expiration
            active
          }
        }
      }
    }
  }
`;

export async function collectMercadoPradoAppCandidates(
  registration: string,
  password: string,
  discoveredAt: string,
  fetcher: typeof fetch = fetch,
): Promise<CollectorResult> {
  const token = await login(registration, password, fetcher);
  const payload = await requestGraphQl<OffersResponse>(offersQuery, {}, fetcher, token);
  throwForGraphQlErrors(payload.errors, "Mercado Prado offers request failed");

  const carousels = payload.data?.home_carousels?.carousels ?? [];
  const discounts = flattenDiscounts(carousels);
  return mercadoPradoDiscountsToCandidates(discounts, discoveredAt);
}

export function mercadoPradoDiscountsToCandidates(
  discounts: MercadoPradoDiscount[],
  discoveredAt: string,
): CollectorResult {
  const candidates: SourceCandidate[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const discount of discounts) {
    const key = String(discount.id ?? discount.image_url ?? discount.name ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    if (discount.active === false || !discount.name?.trim() || !discount.image_url?.trim()) {
      skipped.push(`Mercado Prado offer ${key || "without ID"} lacked an active product name or image`);
      continue;
    }

    const validUntil = expirationFromText(discount.text_expiration, discoveredAt);
    const sourceKey = `${portalUrl}oferta/${encodeURIComponent(key)}`;
    const imageUrl = new URL(discount.image_url, graphQlUrl).toString();
    const priceText = formatPrice(discount.final_price ?? discount.price);
    const evidence = [
      discount.name,
      discount.description,
      discount.promotion_text,
      discount.unit_text,
      discount.text_limit,
      discount.text_expiration,
      priceText && `R$ ${priceText}`,
    ].filter((value): value is string => Boolean(value?.trim()));

    candidates.push({
      id: stableCandidateId("mercado-prado", sourceKey, discount.image_url),
      supermarket: "Mercado Prado",
      sourceUrl: portalUrl,
      imageUrl,
      discoveredAt,
      rawTitle: discount.name.trim(),
      rawCaption: evidence.join(". "),
      mediaType: fileExtension(imageUrl) ?? "image",
      parsedListing: {
        productNames: [discount.name.trim()],
        productCount: 1,
        hasMoreThanThreeProducts: false,
        validUntil,
      },
      structuredOffer: {
        regularPrice: numericPrice(discount.price),
        dealPrice: numericPrice(discount.final_price ?? discount.price),
        unitText: discount.unit_text?.trim() || undefined,
        limitText: discount.text_limit?.trim() || undefined,
      },
    });
  }

  if (!discounts.length) skipped.push("Mercado Prado club returned no current offers");
  return { candidates, skipped };
}

async function login(registration: string, password: string, fetcher: typeof fetch): Promise<string> {
  const normalizedRegistration = registration.replace(/\D/g, "");
  if (!normalizedRegistration || !password) throw new Error("Mercado Prado CPF and password are required");

  const payload = await requestGraphQl<LoginResponse>(
    loginMutation,
    { registration: normalizedRegistration, password },
    fetcher,
  );
  throwForGraphQlErrors(payload.errors, "Mercado Prado login failed");
  const result = payload.data?.userLogin;
  if (!result?.token) {
    const fields = result?.errors?.map((error) => error.field).filter(Boolean).join(", ");
    throw new Error(`Mercado Prado login was rejected${fields ? ` (${fields})` : ""}`);
  }
  return result.token;
}

async function requestGraphQl<T>(
  query: string,
  variables: Record<string, unknown>,
  fetcher: typeof fetch,
  token?: string,
): Promise<T> {
  const response = await fetcher(graphQlUrl, {
    method: "POST",
    headers: {
      "app-version": "web",
      authorization: token ? `Bearer ${token}` : "",
      client: "",
      "content-type": "application/json",
      origin: portalUrl.slice(0, -1),
      referer: portalUrl,
      "user-agent": "FEGROCERY/0.1 (+https://github.com/fw8s7mt9pf-collab/FEGROCERY)",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Mercado Prado API returned ${response.status}`);
  return response.json() as Promise<T>;
}

function flattenDiscounts(carousels: MercadoPradoCarousel[]): MercadoPradoDiscount[] {
  return carousels.flatMap((carousel) => [
    ...(carousel.discounts ?? []),
    ...flattenDiscounts(carousel.carousels ?? []),
  ]);
}

function throwForGraphQlErrors(errors: Array<{ message?: string }> | undefined, fallback: string): void {
  if (errors?.length) throw new Error(errors[0]?.message || fallback);
}

function expirationFromText(text: string | undefined, discoveredAt: string): string | undefined {
  if (!text) return undefined;
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const reference = new Date(discoveredAt);
  if (Number.isNaN(reference.getTime())) return undefined;

  let days: number | undefined;
  if (/\bhoje\b/.test(normalized)) days = 0;
  else if (/\bamanha\b/.test(normalized)) days = 1;
  else days = Number(normalized.match(/\b(?:em|restam?)\s+(\d+)\s+dias?\b/)?.[1]);
  if (days === undefined || !Number.isFinite(days)) return undefined;

  const brazilDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
  const [year, month, day] = brazilDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days + 1, 2, 59, 59)).toISOString();
}

function formatPrice(value: string | number | undefined): string | undefined {
  const numeric = numericPrice(value);
  if (numeric === undefined) return undefined;
  return Number.isFinite(numeric) ? numeric.toFixed(2).replace(".", ",") : undefined;
}

function numericPrice(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function fileExtension(url: string): string | undefined {
  return url.match(/\.([a-z0-9]+)(?:[?#].*)?$/i)?.[1]?.toLowerCase();
}
