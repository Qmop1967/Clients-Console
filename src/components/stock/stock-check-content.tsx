"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Package,
  PackageX,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface StockProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  qty_available: number;
  availability: "available" | "out_of_stock" | "limited";
  availability_ar: string;
  category: string;
}

interface StockCheckContentProps {
  currencyCode: string;
}

export function StockCheckContent({ currencyCode }: StockCheckContentProps) {
  const t = useTranslations("stockCheck");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const formatCurrency = (amount: number) => {
    const decimals = currencyCode === "IQD" ? 0 : 2;
    return (
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount) + ` ${currencyCode}`
    );
  };

  const handleSearch = async () => {
    if (!query || query.length < 2) return;
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(`/api/stock/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const getAvailabilityIcon = (availability: string) => {
    switch (availability) {
      case "available": return <Package className="h-4 w-4 text-green-500" />;
      case "limited": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "out_of_stock": return <PackageX className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAvailabilityVariant = (availability: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (availability) {
      case "available": return "default";
      case "limited": return "secondary";
      case "out_of_stock": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("searchHint")}</p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("searchPlaceholder")}
            className="ps-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || query.length < 2}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("search")}
        </Button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && searched && products.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <PackageX className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("noResults")}</p>
          </CardContent>
        </Card>
      )}

      {!loading && products.length > 0 && (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    {product.sku && (
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    )}
                  </div>
                  <Badge variant={getAvailabilityVariant(product.availability)} className="gap-1 shrink-0 ms-2">
                    {getAvailabilityIcon(product.availability)}
                    {product.availability_ar}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">{t("price")}</span>
                    <p className="font-semibold text-amber-600 dark:text-amber-500">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">{t("qty")}</span>
                    <p className="font-medium">
                      {product.availability === "out_of_stock" ? "0" : Math.round(product.qty_available)}
                    </p>
                  </div>
                  {product.category && (
                    <div>
                      <span className="text-muted-foreground text-xs">{t("category")}</span>
                      <p className="text-xs truncate">{product.category}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
