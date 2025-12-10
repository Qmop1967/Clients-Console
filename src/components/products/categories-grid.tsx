"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Layers } from "lucide-react";
import { getCategoryStyle } from "@/lib/utils/category-icons";
import { cn } from "@/lib/utils/cn";

interface PublicCategory {
  category_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface CategoriesGridProps {
  categories: PublicCategory[];
  productCounts: Record<string, number>;
  onCategorySelect: (categoryId: string) => void;
}

// Memoized Category Card Component
const CategoryCard = memo(function CategoryCard({
  category,
  productCount,
  onClick,
}: {
  category: PublicCategory;
  productCount: number;
  onClick: () => void;
}) {
  const t = useTranslations("products");
  const { Icon, color, bgColor } = getCategoryStyle(category.name);

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:-translate-y-1",
        "hover:border-gold/40 dark:hover:border-gold/30",
        "active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          {/* Icon Container - with category-specific colors */}
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex-shrink-0",
              "flex items-center justify-center",
              bgColor,
              "group-hover:scale-110",
              "transition-all duration-300"
            )}
          >
            <Icon className={cn("h-7 w-7", color, "transition-colors duration-300")} />
          </div>

          {/* Category Info */}
          <div className="flex-1 min-w-0">
            {/* Category Name */}
            <h3 className="font-semibold text-base mb-0.5 truncate group-hover:text-gold transition-colors duration-300">
              {category.name}
            </h3>

            {/* Product Count */}
            <p className="text-sm text-muted-foreground">
              {productCount} {t("productsCount")}
            </p>
          </div>

          {/* Arrow Icon */}
          <div className="flex-shrink-0">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "bg-muted/50 group-hover:bg-gold/20",
              "transition-all duration-300"
            )}>
              <ArrowRight
                className={cn(
                  "h-4 w-4 text-muted-foreground/70",
                  "group-hover:text-gold group-hover:translate-x-0.5",
                  "rtl:rotate-180 rtl:group-hover:-translate-x-0.5",
                  "transition-all duration-300"
                )}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// Category Card Export for use elsewhere if needed
export { CategoryCard };

export function CategoriesGrid({
  categories,
  productCounts,
  onCategorySelect,
}: CategoriesGridProps) {
  const t = useTranslations("products");

  // Filter categories that have products
  const categoriesWithProducts = categories.filter(
    (cat) => (productCounts[cat.category_id] || 0) > 0
  );

  // Sort categories by product count (most products first)
  const sortedCategories = [...categoriesWithProducts].sort(
    (a, b) => (productCounts[b.category_id] || 0) - (productCounts[a.category_id] || 0)
  );

  // Calculate total products across all categories
  const totalProducts = Object.values(productCounts).reduce((sum, count) => sum + count, 0);

  if (sortedCategories.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
          <Layers className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          {t("noCategoriesFound")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("noCategoriesDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{t("browseByCategory")}</h2>
          <p className="text-muted-foreground">{t("selectCategory")}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            {t("totalCategories", { count: sortedCategories.length })}
          </span>
        </div>
      </div>

      {/* Category Grid - 2 columns on mobile, 3 on desktop */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedCategories.map((category) => (
          <CategoryCard
            key={category.category_id}
            category={category}
            productCount={productCounts[category.category_id] || 0}
            onClick={() => onCategorySelect(category.category_id)}
          />
        ))}
      </div>
    </div>
  );
}
