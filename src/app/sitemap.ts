import type { MetadataRoute } from "next";

const BASE = "https://tsh.sale";
const PAGES = ["", "/about", "/catalog", "/contact-us", "/privacy", "/terms"];
const LOCALES = ["ar", "en"];

/** Public company pages only. Partner-portal routes are intentionally excluded. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return LOCALES.flatMap((locale) =>
    PAGES.map((page) => ({
      url: `${BASE}/${locale}${page}`,
      lastModified: now,
      changeFrequency: page === "" ? ("weekly" as const) : ("monthly" as const),
      priority: page === "" ? 1 : 0.7,
    }))
  );
}
