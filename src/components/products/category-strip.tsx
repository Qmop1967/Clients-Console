"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

interface StripCategory {
  category_id: string;
  name: string;
  is_active: boolean;
}

/**
 * CategoryStrip — horizontal, tappable category chips shown at the top of the
 * shop. Replaces the old Categories tab. Scrolls internally (scrollbar-hide),
 * never leaking horizontal scroll to the page.
 */
export function CategoryStrip({
  categories,
  selectedCategory,
  onSelect,
  onClear,
}: {
  categories: StripCategory[];
  selectedCategory?: string | null;
  onSelect?: (categoryId: string) => void;
  onClear?: () => void;
}) {
  const t = useTranslations("products");
  const active = categories.filter((c) => c.is_active);
  if (active.length === 0) return null;

  const chip = (isActive: boolean) =>
    cn(
      "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors native-press whitespace-nowrap",
      isActive
        ? "bg-gold text-white border-gold shadow-sm"
        : "bg-card text-foreground/80 border-border hover:border-gold/40 hover:text-foreground"
    );

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      <button type="button" onClick={onClear} className={chip(!selectedCategory)}>
        {t("allCategories")}
      </button>
      {active.map((c) => (
        <button
          key={c.category_id}
          type="button"
          onClick={() => onSelect?.(c.category_id)}
          className={chip(selectedCategory === c.category_id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
