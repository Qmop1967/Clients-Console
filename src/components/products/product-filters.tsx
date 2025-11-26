"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface ProductFiltersProps {
  categories: Array<{ category_id: string; name: string }>;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  inStockOnly: boolean;
  onInStockChange: (value: boolean) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
}

export function ProductFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  inStockOnly,
  onInStockChange,
  sortBy,
  onSortChange,
}: ProductFiltersProps) {
  const t = useTranslations("products");

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Categories */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              {t("categories")}
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => onCategoryChange(null)}
              >
                {t("allCategories")}
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.category_id}
                  variant={
                    selectedCategory === category.name ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => onCategoryChange(category.name)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>

          {/* In Stock Filter */}
          <div className="flex items-center justify-between">
            <Label htmlFor="in-stock" className="text-sm font-medium">
              {t("filterByStock")}
            </Label>
            <Switch
              id="in-stock"
              checked={inStockOnly}
              onCheckedChange={onInStockChange}
            />
          </div>

          {/* Sort */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              {t("sortBy")}
            </Label>
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">
                  {t("sortOptions.nameAsc")}
                </SelectItem>
                <SelectItem value="name-desc">
                  {t("sortOptions.nameDesc")}
                </SelectItem>
                <SelectItem value="price-asc">
                  {t("sortOptions.priceAsc")}
                </SelectItem>
                <SelectItem value="price-desc">
                  {t("sortOptions.priceDesc")}
                </SelectItem>
                <SelectItem value="stock-desc">
                  {t("sortOptions.stockDesc")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters */}
          {(selectedCategory || inStockOnly) && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                Active filters:
              </span>
              {selectedCategory && (
                <Badge variant="secondary" className="gap-1">
                  {selectedCategory}
                  <button onClick={() => onCategoryChange(null)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {inStockOnly && (
                <Badge variant="secondary" className="gap-1">
                  {t("filterByStock")}
                  <button onClick={() => onInStockChange(false)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
