"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitMerge,
  Plus,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface DraftOrder {
  id: number;
  name: string;
  date: string;
  state: string;
  itemCount: number;
  total: number;
  currencyCode: string;
  lines: Array<{
    lineId: number;
    productId: number;
    productName: string;
    quantity: number;
    priceUnit: number;
    subtotal: number;
  }>;
}

interface DraftOrderMergeProps {
  drafts: DraftOrder[];
  currencyCode: string;
  onMerge: (orderId: number) => Promise<void>;
  onNewOrder: () => void;
  isMerging: boolean;
  mergeResult: { success: boolean; addedCount?: number; updatedCount?: number; orderName?: string } | null;
}

export function DraftOrderMerge({
  drafts,
  currencyCode,
  onMerge,
  onNewOrder,
  isMerging,
  mergeResult,
}: DraftOrderMergeProps) {
  const t = useTranslations("cartMerge");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: currencyCode === "USD" ? 2 : 0,
      maximumFractionDigits: currencyCode === "USD" ? 2 : 0,
    }).format(amount);
  };

  // Success state
  if (mergeResult?.success) {
    return (
      <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-800 dark:text-green-200">
                {t("mergeSuccess")}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                {t("mergeSuccessDetail", {
                  added: mergeResult.addedCount || 0,
                  updated: mergeResult.updatedCount || 0,
                  order: mergeResult.orderName || "",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0">
            <GitMerge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-blue-800 dark:text-blue-200">
              {t("title")}
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
              {t("description", { count: drafts.length })}
            </p>
          </div>
        </div>

        {/* Draft Orders List */}
        <div className="space-y-2">
          {drafts.map((draft) => {
            const isExpanded = expandedId === draft.id;

            return (
              <div
                key={draft.id}
                className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 overflow-hidden"
              >
                {/* Order Summary Row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{draft.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {draft.state === "draft" ? t("statusDraft") : t("statusSent")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      <span>
                        {t("itemsSummary", { count: draft.itemCount })}
                      </span>
                      <span>•</span>
                      <span>
                        {formatCurrency(draft.total)} {draft.currencyCode}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onMerge(draft.id)}
                      disabled={isMerging}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      {isMerging ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <GitMerge className="h-3.5 w-3.5 ml-1" />
                          {t("mergeButton")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Lines */}
                {isExpanded && draft.lines.length > 0 && (
                  <div className="border-t border-blue-100 dark:border-blue-800 px-3 py-2 bg-gray-50 dark:bg-gray-950">
                    <div className="space-y-1.5">
                      {draft.lines.map((line) => (
                        <div
                          key={line.lineId}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="truncate flex-1 ml-2">
                            {line.productName}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            ×{line.quantity.toLocaleString("en-US")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* New Order Option */}
        <Button
          variant="outline"
          className="w-full text-sm"
          onClick={onNewOrder}
          disabled={isMerging}
        >
          <Plus className="h-4 w-4 ml-1.5" />
          {t("newOrderButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
