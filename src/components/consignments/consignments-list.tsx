"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ChevronRight, Inbox } from "lucide-react";

interface Consignment {
  id: number;
  x_name: string;
  x_state: string;
  x_date_delivered: string | null;
  line_count: number;
  total_remaining: number;
  total_sold: number;
}

interface Props {
  consignments: Consignment[];
  total: number;
  currencyCode: string;
}

const stateColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  delivered: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  closing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function ConsignmentsList({ consignments, total }: Props) {
  const t = useTranslations("consignments");

  if (!consignments || consignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Inbox className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold text-muted-foreground">{t("empty")}</h2>
        <p className="text-sm text-muted-foreground/70 mt-1">{t("emptyDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Badge variant="secondary" className="text-xs">
          {total.toLocaleString("en-US")}
        </Badge>
      </div>

      <div className="space-y-3">
        {consignments.map((c) => {
          const stateKey = ("state" + c.x_state.charAt(0).toUpperCase() + c.x_state.slice(1)) as any;
          return (
            <Link key={c.id} href={`/consignments/${c.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.x_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`text-[10px] px-1.5 py-0 ${stateColors[c.x_state] || stateColors.active}`}>
                            {t(stateKey)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {c.line_count.toLocaleString("en-US")} {t("lineCount")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <p className="text-xs text-muted-foreground">{t("qtyRemaining")}</p>
                        <p className="font-bold text-sm">{Number(c.total_remaining).toLocaleString("en-US")}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                    </div>
                  </div>
                  {c.x_date_delivered && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("deliveredDate")}: {new Date(c.x_date_delivered).toLocaleDateString("en-US")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
