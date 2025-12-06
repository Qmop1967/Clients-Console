"use client";

import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { CategoryWithProducts } from "@/lib/ai/categories";
import { Sparkles, ChevronRight, Loader2 } from "lucide-react";

interface CategoryAccordionProps {
  categories: CategoryWithProducts[];
  onCategorySelect: (categoryId: string, categoryName: string) => void;
  selectedCategory?: string;
  isLoading?: boolean;
  totalProducts: number;
}

export function CategoryAccordion({
  categories,
  onCategorySelect,
  selectedCategory,
  isLoading = false,
  totalProducts,
}: CategoryAccordionProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const isRTL = locale === "ar";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t("loadingCategories")}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header with AI Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="gold" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            {t("aiClassified")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {totalProducts} {t("productsTotal")}
          </span>
        </div>
      </div>

      {/* All Products Button */}
      <Button
        variant={!selectedCategory ? "default" : "outline"}
        className={cn(
          "w-full justify-between",
          !selectedCategory && "bg-primary text-primary-foreground"
        )}
        onClick={() => onCategorySelect("", "")}
      >
        <span className="flex items-center gap-2">
          <span>📦</span>
          {t("allProducts")}
        </span>
        <Badge variant="secondary">{totalProducts}</Badge>
      </Button>

      {/* Category Accordion */}
      <Accordion type="single" collapsible className="space-y-2">
        {categories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <AccordionItem
              value={category.id}
              className={cn(
                "border rounded-lg px-4 bg-card/50 hover:bg-card transition-colors",
                selectedCategory === category.name && "border-primary bg-primary/5"
              )}
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-start">
                  <span className="text-xl">{category.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">
                      {isRTL ? category.name_ar : category.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {category.product_count} {t("productsTotal")}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {/* Parent Category Button */}
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-between h-10 text-sm",
                      selectedCategory === category.name &&
                        "bg-primary/10 text-primary"
                    )}
                    onClick={() => onCategorySelect(category.id, category.name)}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                      {t("viewAll")} {isRTL ? category.name_ar : category.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {category.product_count}
                    </Badge>
                  </Button>

                  {/* Sub-categories */}
                  {category.children?.map((subCategory) => (
                    <Button
                      key={subCategory.id}
                      variant="ghost"
                      className={cn(
                        "w-full justify-between h-10 text-sm ps-8",
                        selectedCategory === subCategory.name &&
                          "bg-primary/10 text-primary"
                      )}
                      onClick={() =>
                        onCategorySelect(subCategory.id, subCategory.name)
                      }
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        {isRTL ? subCategory.name_ar : subCategory.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {subCategory.product_count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>

      {/* Empty State */}
      {categories.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏷️</div>
          <p className="text-muted-foreground">{t("noCategoriesYet")}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t("categoriesWillAppear")}
          </p>
        </div>
      )}
    </motion.div>
  );
}
