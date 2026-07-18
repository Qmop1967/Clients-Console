"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Loader2, Package, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SuggestProduct {
  id: string;
  name: string;
  sku: string;
}

interface SuggestCategory {
  id: string;
  name: string;
}

interface SuggestResponse {
  products: SuggestProduct[];
  categories: SuggestCategory[];
}

/**
 * HeaderSearch — always-available catalog search living in the shop header
 * (the header is a shrink-0 child of the fixed app shell, so it is effectively
 * sticky: the search never scrolls away).
 *
 * - Debounced live suggestions (products by name/SKU + categories) from
 *   /api/shop/suggest — tolerant of common Arabic spelling variants.
 * - Enter (or "show all") → /{locale}/shop?q=… where the existing client-side
 *   filtering takes over. Suggestion tap → straight to the product page.
 * - Dropdown needs a high z-index: the header sits above the scrolling main
 *   (fixed-shell pattern), and popovers must never clip under it.
 */
export function HeaderSearch({ locale }: { locale: string }) {
  const t = useTranslations("products");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SuggestResponse | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside tap
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const fetchSuggestions = useCallback(
    (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      fetch(`/api/shop/suggest?q=${encodeURIComponent(q)}&lang=${locale}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SuggestResponse | null) => {
          if (data) setResults(data);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setLoading(false);
        });
    },
    [locale]
  );

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults(null);
      setOpen(q.length > 0);
      return;
    }
    setOpen(true);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 250);
  };

  const goToFullSearch = () => {
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/${locale}/shop?q=${encodeURIComponent(q)}` : `/${locale}/shop`);
  };

  const hasResults =
    !!results && (results.products.length > 0 || results.categories.length > 0);

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goToFullSearch();
        }}
      >
        <Search
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder={t("headerSearchPlaceholder")}
          aria-label={t("headerSearchPlaceholder")}
          className={cn(
            "h-10 w-full rounded-xl border border-border/60 bg-background/60 ps-9 pe-3 text-sm",
            "outline-none transition-colors placeholder:text-muted-foreground/70",
            "focus:border-primary/50 focus:bg-background"
          )}
        />
      </form>

      {open && (
        <div
          className={cn(
            "absolute inset-x-0 top-[calc(100%+6px)] z-[80] overflow-hidden rounded-xl",
            "border border-border bg-popover text-popover-foreground shadow-xl"
          )}
        >
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("searching")}
            </div>
          )}

          {!loading && !hasResults && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {t("noSuggestions")}
            </div>
          )}

          {!loading && results && results.products.length > 0 && (
            <div className="py-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                {t("suggestProducts")}
              </p>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/${locale}/shop/${p.id}`);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-start text-sm transition-colors hover:bg-secondary"
                >
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="line-clamp-1 flex-1">{p.name}</span>
                  {p.sku && (
                    <span dir="ltr" className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {p.sku}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && results && results.categories.length > 0 && (
            <div className="border-t border-border/60 py-1">
              <p className="px-4 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                {t("suggestCategories")}
              </p>
              {results.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/${locale}/shop?category=${encodeURIComponent(c.id)}`);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-start text-sm transition-colors hover:bg-secondary"
                >
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="line-clamp-1">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && (
            <button
              type="button"
              onClick={goToFullSearch}
              className="block w-full border-t border-border/60 px-4 py-2.5 text-start text-sm font-medium text-primary transition-colors hover:bg-secondary"
            >
              {t("showAllResults", { query: query.trim() })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
