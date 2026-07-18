// ============================================
// Storefront promos — /api/shop/promos
// ============================================
// Admin-managed promotional slides for the shop page, stored in the Odoo
// system parameter `tsh.storefront.promos` (JSON array — d-012: reuse
// existing models, no new tables). Editable from Odoo → Settings →
// Technical → System Parameters (tsh-admin UI can wrap this later).
//
// Slide shape:
// { "id": "eid-offer", "title": "…", "subtitle": "…", "badge": "…",
//   "cta_label": "…", "cta_href": "/ar/shop?category=42" | "#new-arrivals",
//   "active": true, "from": "2026-07-01", "to": "2026-07-31" }
//
// Cached 120s (unstable_cache) → one gateway read per 2 minutes max.
//
// SECURITY: ir.config_parameter is NOT readable via the generic odoo proxy
// (it holds system secrets). The gateway exposes exactly this one key through
// the scoped /api/storefront/promos route — we call that instead.
// ============================================

import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { gatewayPost } from "@/lib/odoo/client";

export const dynamic = "force-dynamic";

export interface PromoSlide {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  cta_label?: string;
  cta_href?: string;
  active?: boolean;
  from?: string;
  to?: string;
}

const getPromosCached = unstable_cache(
  async (): Promise<PromoSlide[]> => {
    try {
      const slides = await gatewayPost<unknown>("/api/storefront/promos", {});
      if (!Array.isArray(slides)) return [];
      return slides.filter(
        (s): s is PromoSlide => !!s && typeof s === "object" && typeof s.title === "string"
      );
    } catch (error) {
      console.error("[Promos] failed to read storefront promos:", error);
      return [];
    }
  },
  ["sf-storefront-promos-v2"],
  { revalidate: 120, tags: ["promos"] }
);

export async function GET() {
  const slides = await getPromosCached();

  // Server-side gate: active flag + optional date window
  const now = Date.now();
  const visible = slides.filter((s) => {
    if (s.active === false) return false;
    if (s.from && now < Date.parse(s.from)) return false;
    if (s.to && now > Date.parse(s.to) + 24 * 60 * 60 * 1000 - 1) return false;
    return true;
  });

  return NextResponse.json(
    { slides: visible },
    { headers: { "Cache-Control": "public, max-age=60" } }
  );
}
