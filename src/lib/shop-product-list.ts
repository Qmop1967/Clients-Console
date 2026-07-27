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

export function hasProductImage(
  product: Pick<ShopListProduct, "image_url">
): boolean {
  if (typeof product.image_url !== "string" || product.image_url.trim().length === 0) {
    return false;
  }

  // Odoo maps missing DAM media to this public asset instead of returning null.
  const imagePath = product.image_url.trim().toLocaleLowerCase().split(/[?#]/, 1)[0];
  return !imagePath.endsWith("/images/product-placeholder.svg");
}

function getCreatedAt(product: Pick<ShopListProduct, "create_date">): number {
  if (!product.create_date) return 0;
  const parsed = Date.parse(product.create_date.replace(" ", "T") + "Z");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function selectImageReadyNewArrivals<T extends ShopListProduct>(
  products: readonly T[],
  limit = 12
): T[] {
  if (limit <= 0) return [];

  return products
    .filter((product) => product.available_stock > 0 && hasProductImage(product))
    .slice()
    .sort((a, b) => {
      const createdDifference = getCreatedAt(b) - getCreatedAt(a);
      if (createdDifference !== 0) return createdDifference;
      return compareNewest(a, b);
    })
    .slice(0, limit);
}

function compareNewest(a: ShopListProduct, b: ShopListProduct): number {
  const aId = Number.parseInt(a.item_id, 10);
  const bId = Number.parseInt(b.item_id, 10);
  return (Number.isFinite(bId) ? bId : 0) - (Number.isFinite(aId) ? aId : 0);
}

export function filterAndSortShopProducts<T extends ShopListProduct>(
  products: readonly T[],
  options: ShopListOptions
): T[] {
  const query = options.query.trim().toLocaleLowerCase();
  const filtered = products.filter((product) => {
    if (!matchesStockFilter(product, options.stockFilter)) return false;
    if (!query) return true;

    return [product.name, product.sku, product.description, product.brand].some(
      (value) => value?.toLocaleLowerCase().includes(query)
    );
  });

  return filtered.sort((a, b) => {
    const aHasImage = hasProductImage(a);
    const bHasImage = hasProductImage(b);

    // Image-ready products are always merchandised first. Because this comparator
    // runs before pagination, missing-image cards naturally occupy the final pages.
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
