"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Layers } from "lucide-react";
import { getCategoryIcon, getCategoryIconColor } from "@/lib/utils/category-icons";
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
  const Icon = getCategoryIcon(category.name);
  const iconColor = getCategoryIconColor(category.name);

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:shadow-lg hover:-translate-y-1",
        "hover:border-gold/30 dark:hover:border-gold/20",
        "active:scale-[0.98] native-press"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Icon Container */}
            <div
              className={cn(
                "w-14 h-14 rounded-xl mb-4",
                "flex items-center justify-center",
                "bg-primary/10 dark:bg-primary/5",
                "group-hover:bg-gold/20 dark:group-hover:bg-gold/10",
                "transition-colors duration-300"
              )}
            >
              <Icon className={cn("h-7 w-7", iconColor, "group-hover:text-gold transition-colors duration-300")} />
            </div>

            {/* Category Name */}
            <h3 className="font-semibold text-lg mb-1 truncate group-hover:text-gold transition-colors duration-300">
              {category.name}
            </h3>

            {/* Product Count */}
            <p className="text-sm text-muted-foreground">
              {productCount} {t("productsCount")}
            </p>

            {/* Description (if available) */}
            {category.description && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                {category.description}
              </p>
            )}
          </div>

          {/* Arrow Icon */}
          <div className="ms-4 flex-shrink-0">
            <ArrowRight
              className={cn(
                "h-5 w-5 text-muted-foreground/50",
                "group-hover:text-gold group-hover:translate-x-1",
                "rtl:rotate-180 rtl:group-hover:-translate-x-1",
                "transition-all duration-300"
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

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
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t("browseByCategory")}</h2>
        <p className="text-muted-foreground">{t("selectCategory")}</p>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedCategories.map((category) => (
          <CategoryCard
            key={category.category_id}
            category={category}
            productCount={productCounts[category.category_id] || 0}
            onClick={() => onCategorySelect(category.category_id)}
          />
        ))}
      </div>

      {/* Total Categories Info */}
      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground text-center">
          {t("totalCategories", { count: sortedCategories.length })}
        </p>
      </div>
    </div>
  );
}
