"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Box,
  MapPin,
  Calendar,
  PackageCheck,
} from "lucide-react";
import type { ClientPackage } from "@/lib/odoo/packages";

interface PackagesContentProps {
  packages: ClientPackage[];
  total: number;
}

export function PackagesContent({ packages, total }: PackagesContentProps) {
  const t = useTranslations("packages");

  const formatDate = (date: string | false) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return String(date).split(" ")[0];
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total > 0 ? t("count", { count: total }) : t("subtitle")}
        </p>
      </div>

      {/* Stats Card */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("totalPackages")}</p>
              <p className="stat-number text-3xl">{total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Packages List */}
      {packages.length === 0 ? (
        <Card variant="elevated" className="py-12">
          <CardContent className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <PackageCheck className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">{t("noPackages")}</h3>
            <p className="text-sm text-muted-foreground">{t("noPackagesDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} variant="elevated" className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Package Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                      <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <span className="font-display font-semibold block">{pkg.name}</span>
                      {pkg.package_type && (
                        <span className="text-xs text-muted-foreground">{pkg.package_type}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Box className="h-3 w-3" />
                    {pkg.total_items} {t("items")}
                  </Badge>
                </div>

                {/* Package Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-xs text-muted-foreground block">{t("date")}</span>
                      <span className="font-medium">{formatDate(pkg.pack_date)}</span>
                    </div>
                  </div>
                  {pkg.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-xs text-muted-foreground block">{t("location")}</span>
                        <span className="font-medium text-xs truncate">{pkg.location}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items Preview */}
                {pkg.items && pkg.items.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-2">{t("contents")}</p>
                    <div className="space-y-1">
                      {pkg.items.slice(0, 5).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">
                            {Array.isArray(item.product_id) ? item.product_id[1] : `Product #${item.product_id}`}
                          </span>
                          <span className="text-muted-foreground shrink-0 ms-2">
                            ×{Math.round(item.quantity)}
                          </span>
                        </div>
                      ))}
                      {pkg.items.length > 5 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          +{pkg.items.length - 5} {t("moreItems")}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
