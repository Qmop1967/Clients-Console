"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { CategoryTree } from "./category-tree";
import { CategoryAccordion } from "./category-accordion";
import { Button } from "@/components/ui/button";
import { Loader2, TreeDeciduous, List, RefreshCw, X } from "lucide-react";
import {
  CategoryWithProducts,
  convertToTreeData,
  buildCategoryTreeWithCounts,
  AIClassification,
  CATEGORY_HIERARCHY,
} from "@/lib/ai/categories";

interface CategoryTabProps {
  products: Array<{
    item_id: string;
    name: string;
    category_id?: string;
    category_name?: string;
  }>;
  onCategorySelect: (categoryName: string, itemIds: string[]) => void;
  selectedCategory?: string;
}

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export function CategoryTab({
  products,
  onCategorySelect,
  selectedCategory,
}: CategoryTabProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const [classifications, setClassifications] = useState<AIClassification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"auto" | "tree" | "list">("auto");

  // Fetch classifications on mount
  useEffect(() => {
    fetchClassifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClassifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/classify?action=all`);
      const data = await response.json();

      if (data.success && data.data) {
        setClassifications(data.data);
      } else {
        // Use Zoho categories as fallback
        const fallbackClassifications = createFallbackClassifications(products);
        setClassifications(fallbackClassifications);
      }
    } catch (err) {
      console.error("Failed to fetch classifications:", err);
      // Use Zoho categories as fallback
      const fallbackClassifications = createFallbackClassifications(products);
      setClassifications(fallbackClassifications);
    } finally {
      setIsLoading(false);
    }
  };

  // Create fallback classifications from Zoho categories
  const createFallbackClassifications = (
    prods: typeof products
  ): AIClassification[] => {
    return prods
      .filter((p) => p.category_name)
      .map((p) => ({
        item_id: p.item_id,
        primary_category: p.category_name || "Accessories",
        sub_category: p.category_name || "Miscellaneous",
        tags: [],
        confidence: 30,
        model: "zoho-fallback",
        classified_at: new Date().toISOString(),
        zoho_category_id: p.category_id,
        zoho_category_name: p.category_name,
      }));
  };

  // Build category tree with counts
  const categoriesWithCounts = useMemo(() => {
    if (classifications.length === 0) {
      // Return empty categories with 0 counts
      return CATEGORY_HIERARCHY.map((cat) => ({
        ...cat,
        product_count: 0,
        children: cat.children?.map((child) => ({
          ...child,
          product_count: 0,
        })),
      })) as CategoryWithProducts[];
    }
    return buildCategoryTreeWithCounts(classifications);
  }, [classifications]);

  // Convert to tree data for desktop view
  const treeData = useMemo(() => {
    return convertToTreeData(categoriesWithCounts, locale as "en" | "ar");
  }, [categoriesWithCounts, locale]);

  // Handle category selection - find all item_ids in the selected category
  const handleCategorySelect = useCallback(
    (categoryId: string, categoryName: string) => {
      // First, find the English category name if Arabic was passed
      let englishCategoryName = categoryName;
      for (const cat of CATEGORY_HIERARCHY) {
        if (cat.name_ar === categoryName) {
          englishCategoryName = cat.name;
          break;
        }
        if (cat.children) {
          for (const child of cat.children) {
            if (child.name_ar === categoryName) {
              englishCategoryName = child.name;
              break;
            }
          }
        }
      }

      // Find all items that belong to this category (primary or sub)
      const matchingItemIds = classifications
        .filter(c =>
          c.primary_category === englishCategoryName ||
          c.sub_category === englishCategoryName
        )
        .map(c => c.item_id);

      onCategorySelect(categoryName, matchingItemIds);
    },
    [onCategorySelect, classifications]
  );

  // Determine which view to show
  const showTree = viewMode === "tree" || (viewMode === "auto" && !isMobile);

  return (
    <div className="space-y-4">
      {/* View Toggle - Desktop only */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "tree" || (viewMode === "auto" && !isMobile) ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setViewMode("tree")}
          >
            <TreeDeciduous className="h-4 w-4" />
            {t("viewAsTree")}
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
            {t("viewAsList")}
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={fetchClassifications}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          {t("refresh")}
        </Button>
      </div>

      {/* Selected Category Clear Button */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg"
          >
            <span className="text-sm">
              {t("filtering")}: <strong>{selectedCategory}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ms-auto"
              onClick={() => onCategorySelect("", [])}
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Category Views */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-12"
          >
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">{t("loadingCategories")}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={showTree ? "tree" : "list"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {showTree && !isMobile ? (
              <CategoryTree
                treeData={treeData}
                onCategorySelect={handleCategorySelect}
                selectedCategory={selectedCategory}
              />
            ) : (
              <CategoryAccordion
                categories={categoriesWithCounts}
                onCategorySelect={handleCategorySelect}
                selectedCategory={selectedCategory}
                totalProducts={products.length}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Footer */}
      <div className="flex items-center justify-center gap-4 pt-4 border-t text-sm text-muted-foreground">
        <span>
          {classifications.length} {t("productsClassified")}
        </span>
        <span>|</span>
        <span>
          {categoriesWithCounts.filter((c) => c.product_count > 0).length}{" "}
          {t("activeCategories")}
        </span>
      </div>
    </div>
  );
}
