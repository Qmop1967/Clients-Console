"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "./product-card";
import { ProductFilters } from "./product-filters";
import { Search, Filter, Grid, List } from "lucide-react";

interface ProductsContentProps {
  priceListId?: string;
  currencyCode: string;
}

// Mock data - will be replaced with real Zoho data
const mockProducts = [
  {
    item_id: "1",
    name: "Hikvision DS-2CD2143G2-I 4MP Camera",
    sku: "HIK-DS2CD2143G2I",
    rate: 185000,
    available_stock: 45,
    image_url: null,
    category_name: "Surveillance Systems",
  },
  {
    item_id: "2",
    name: "TP-Link Archer AX73 WiFi 6 Router",
    sku: "TPL-ARCHERAX73",
    rate: 125000,
    available_stock: 32,
    image_url: null,
    category_name: "Networking",
  },
  {
    item_id: "3",
    name: "HP LaserJet Pro M404dn Printer",
    sku: "HP-LJM404DN",
    rate: 320000,
    available_stock: 12,
    image_url: null,
    category_name: "Printing Devices",
  },
  {
    item_id: "4",
    name: "Dell Latitude 5530 Laptop",
    sku: "DELL-LAT5530",
    rate: 1250000,
    available_stock: 8,
    image_url: null,
    category_name: "Computers",
  },
  {
    item_id: "5",
    name: "APC Smart-UPS 1500VA",
    sku: "APC-SMT1500",
    rate: 450000,
    available_stock: 15,
    image_url: null,
    category_name: "Power Solutions",
  },
  {
    item_id: "6",
    name: "Dahua DH-IPC-HDW2431T-AS 4MP Camera",
    sku: "DH-IPCHDW2431T",
    rate: 145000,
    available_stock: 67,
    image_url: null,
    category_name: "Surveillance Systems",
  },
  {
    item_id: "7",
    name: "Ubiquiti UniFi AP-AC-Pro",
    sku: "UBQ-UAPACPRO",
    rate: 195000,
    available_stock: 23,
    image_url: null,
    category_name: "Networking",
  },
  {
    item_id: "8",
    name: "Canon PIXMA G3420 Printer",
    sku: "CAN-PIXG3420",
    rate: 185000,
    available_stock: 0,
    image_url: null,
    category_name: "Printing Devices",
  },
];

const mockCategories = [
  { category_id: "1", name: "Surveillance Systems" },
  { category_id: "2", name: "Networking" },
  { category_id: "3", name: "Printing Devices" },
  { category_id: "4", name: "Computers" },
  { category_id: "5", name: "Power Solutions" },
];

export function ProductsContent({
  priceListId,
  currencyCode,
}: ProductsContentProps) {
  const t = useTranslations("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let products = [...mockProducts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      products = products.filter(
        (p) => p.category_name === selectedCategory
      );
    }

    // Stock filter
    if (inStockOnly) {
      products = products.filter((p) => p.available_stock > 0);
    }

    // Sort
    products.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return a.rate - b.rate;
        case "price-desc":
          return b.rate - a.rate;
        case "stock-desc":
          return b.available_stock - a.available_stock;
        default:
          return 0;
      }
    });

    return products;
  }, [searchQuery, selectedCategory, inStockOnly, sortBy]);

  // Products in stock only
  const productsInStock = filteredProducts.filter((p) => p.available_stock > 0);

  // Products grouped by category
  const productsByCategory = useMemo(() => {
    const grouped: Record<string, typeof mockProducts> = {};
    filteredProducts.forEach((product) => {
      const category = product.category_name || "Other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(product);
    });
    return grouped;
  }, [filteredProducts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <Grid className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters */}
      {showFilters && (
        <ProductFilters
          categories={mockCategories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          inStockOnly={inStockOnly}
          onInStockChange={setInStockOnly}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            {t("allProducts")} ({productsInStock.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="flex-1">
            {t("catalog")}
          </TabsTrigger>
        </TabsList>

        {/* All Products Tab */}
        <TabsContent value="all" className="mt-4">
          {productsInStock.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t("noProducts")}
            </div>
          ) : (
            <div className="product-grid">
              {productsInStock.map((product) => (
                <ProductCard
                  key={product.item_id}
                  product={product}
                  currencyCode={currencyCode}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="mt-4">
          <div className="space-y-8">
            {Object.entries(productsByCategory).map(([category, products]) => (
              <div key={category}>
                <h2 className="mb-4 text-lg font-semibold">{category}</h2>
                <div className="product-grid">
                  {products.map((product) => (
                    <ProductCard
                      key={product.item_id}
                      product={product}
                      currencyCode={currencyCode}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
