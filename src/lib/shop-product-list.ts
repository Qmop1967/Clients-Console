export type StockFilter = "in-stock" | "all" | "out-of-stock";

export type ShopSortOption =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "stock-desc";

export interface ShopListProduct {
  item_id: string;
  name: string;
  /** Canonical (usually English) name — searchable, never rendered. */
  alt_name?: string;
  sku: string;
  description?: string;
  brand?: string;
  rate: number;
  available_stock: number;
  image_url?: string | null;
  create_date?: string;
}

interface ShopListOptions {
  query: string;
  sortBy: ShopSortOption;
  stockFilter: StockFilter;
}

export function normalizeStockFilter(value: string | null): StockFilter {
  if (value === "all" || value === "out-of-stock") return value;
  return "in-stock";
}

export function matchesStockFilter(
  product: Pick<ShopListProduct, "available_stock">,
  stockFilter: StockFilter
): boolean {
  if (stockFilter === "all") return true;
  if (stockFilter === "out-of-stock") return product.available_stock <= 0;
  return product.available_stock > 0;
}

/**
 * True when the card will render a REAL product photo.
 *
 * Two distinct "no photo" shapes exist and both must be detected, otherwise the
 * missing-photo products stop sinking to the last pages:
 *   1. `/images/product-placeholder.svg` — the static asset used when a product has
 *      neither DAM media nor an Odoo image.
 *   2. `/api/images/<pp_id>?ph=1` — the gateway's deterministic colored SVG, returned
 *      by getProductImageOrPlaceholderUrl() when the product has no image_1920.
 *      This one LOOKS like a real image URL, so a suffix check alone misses it.
 */
export function hasProductImage(
  product: Pick<ShopListProduct, "image_url">
): boolean {
  if (typeof product.image_url !== "string" || product.image_url.trim().length === 0) {
    return false;
  }

  const normalized = product.image_url.trim().toLocaleLowerCase();
  const [pathAndQuery] = normalized.split("#");
  const [path, query = ""] = pathAndQuery.split("?");

  if (path.endsWith("/images/product-placeholder.svg")) return false;
  if (/(?:^|&)ph=1(?:&|$)/.test(query)) return false;

  return true;
}

function getCreatedAt(product: Pick<ShopListProduct, "create_date">): number {
  if (!product.create_date) return 0;
  const parsed = Date.parse(product.create_date.replace(" ", "T") + "Z");
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Matches the gold "New" badge on the cards (public-products-content.tsx). */
export const NEW_ARRIVAL_WINDOW_DAYS = 45;

/** Below this the rail is not worth a whole row — the grid already shows them. */
export const MIN_NEW_ARRIVALS = 4;

/**
 * Products for the New Arrivals rail.
 *
 * FIX: the rail used to take "the 12 newest in-stock photographed products",
 * which is EXACTLY what the grid's default "Newest" sort puts on page 1 — the
 * customer scrolled past twelve cards and then met the same twelve again 200px
 * lower. It now only offers genuinely new products, using the same 45-day window
 * as the "New" badge, and the caller drops the rail entirely when too few
 * qualify. `now` is injected so the cutoff is testable.
 */
export function selectImageReadyNewArrivals<T extends ShopListProduct>(
  products: readonly T[],
  limit = 12,
  now: number = Date.now()
): T[] {
  if (limit <= 0) return [];
  const cutoff = now - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return products
    .filter((product) =>
      product.available_stock > 0
      && hasProductImage(product)
      && getCreatedAt(product) >= cutoff
    )
    .slice()
    .sort((a, b) => {
      const createdDifference = getCreatedAt(b) - getCreatedAt(a);
      if (createdDifference !== 0) return createdDifference;
      return compareById(a, b);
    })
    .slice(0, limit);
}

function compareById(a: ShopListProduct, b: ShopListProduct): number {
  const aId = Number.parseInt(a.item_id, 10);
  const bId = Number.parseInt(b.item_id, 10);
  return (Number.isFinite(bId) ? bId : 0) - (Number.isFinite(aId) ? aId : 0);
}

/**
 * "Newest" must agree with the gold "New" badge, which is driven by create_date.
 * Sorting by item_id alone put a freshly created product built on an OLD Odoo
 * template near the bottom of "Newest" while still wearing the New badge.
 */
function compareNewest(a: ShopListProduct, b: ShopListProduct): number {
  return (getCreatedAt(b) - getCreatedAt(a)) || compareById(a, b);
}

export function filterAndSortShopProducts<T extends ShopListProduct>(
  products: readonly T[],
  options: ShopListOptions
): T[] {
  const query = options.query.trim().toLocaleLowerCase();
  const filtered = products.filter((product) => {
    if (!matchesStockFilter(product, options.stockFilter)) return false;
    if (!query) return true;

    // alt_name keeps English search working on the Arabic storefront: the card
    // shows the Arabic name, but traders type "headphone" or a model number.
    return [product.name, product.alt_name, product.sku, product.description, product.brand].some(
      (value) => value?.toLocaleLowerCase().includes(query)
    );
  });

  return filtered.sort((a, b) => {
    const aHasImage = hasProductImage(a);
    const bHasImage = hasProductImage(b);

    // Photographed products are always merchandised first. Because this comparator
    // runs BEFORE pagination, products still awaiting photography land on the final
    // pages of the complete result set instead of being hidden or mixed into page 1.
    if (aHasImage !== bHasImage) return aHasImage ? -1 : 1;

    let result = 0;
    switch (options.sortBy) {
      case "name-asc":
        result = a.name.localeCompare(b.name);
        break;
      case "name-desc":
        result = b.name.localeCompare(a.name);
        break;
      case "price-asc":
        result = a.rate - b.rate;
        break;
      case "price-desc":
        result = b.rate - a.rate;
        break;
      case "stock-desc":
        result = b.available_stock - a.available_stock;
        break;
      case "newest":
      default:
        result = compareNewest(a, b);
        break;
    }

    return result || compareNewest(a, b);
  });
}
