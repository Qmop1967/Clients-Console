import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/zoho/client";

// Simple revalidation endpoint
// Usage: GET /api/revalidate?tag=products
// Available tags: products, categories, price-lists, all
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag");
  const secret = searchParams.get("secret");

  // Basic protection - require secret in production
  const expectedSecret = process.env.REVALIDATE_SECRET || "tsh-revalidate-2024";
  if (secret !== expectedSecret) {
    return NextResponse.json(
      { error: "Invalid secret" },
      { status: 401 }
    );
  }

  const revalidated: string[] = [];

  try {
    switch (tag) {
      case "products":
      case "all":
        revalidateTag(CACHE_TAGS.PRODUCTS);
        revalidateTag("all-products-complete");
        revalidateTag("products-in-stock");
        revalidateTag("product");
        revalidateTag("all-products");
        revalidated.push("products", "all-products-complete", "products-in-stock", "product", "all-products");
        if (tag !== "all") break;
      // falls through for "all"
      case "categories":
        revalidateTag(CACHE_TAGS.CATEGORIES);
        revalidateTag("categories");
        revalidated.push("categories");
        if (tag !== "all") break;
      // falls through for "all"
      case "price-lists":
        revalidateTag(CACHE_TAGS.PRICE_LISTS);
        revalidateTag("price-lists");
        revalidated.push("price-lists");
        if (tag !== "all") break;
      // falls through for "all"
      case "warehouses":
        revalidateTag("warehouses");
        revalidateTag("wholesale-warehouse-id");
        revalidated.push("warehouses", "wholesale-warehouse-id");
        break;
      default:
        if (tag) {
          revalidateTag(tag);
          revalidated.push(tag);
        } else {
          return NextResponse.json(
            { error: "Missing tag parameter. Use: products, categories, price-lists, warehouses, or all" },
            { status: 400 }
          );
        }
    }

    return NextResponse.json({
      success: true,
      revalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Revalidate] Error:", error);
    return NextResponse.json(
      { error: "Failed to revalidate", details: String(error) },
      { status: 500 }
    );
  }
}
