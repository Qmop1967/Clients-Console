"use client";

// عرض تقرير الجرد والمطابقة داخل البوابة (srcDoc لتجاوز X-Frame-Options) مع الطباعة والتنزيل.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, Printer } from "lucide-react";

export function CustodyVisitReport({ visitId }: { visitId: number }) {
  const t = useTranslations("consignments");
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/consignments/visits/${visitId}/document/html`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => { if (!cancelled) setHtml(text); })
      .catch(() => { if (!cancelled) setError(t("visitReportError")); });
    return () => { cancelled = true; };
  }, [visitId, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/consignments/visits">
          <Button variant="ghost" size="icon" className="rtl:rotate-180"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{t("visitReportTitle")}</h1>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => window.open(`/api/consignments/visits/${visitId}/document/print`, "_blank")}>
          <Printer className="h-4 w-4 me-1" /> {t("printDocument")}
        </Button>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => window.open(`/api/consignments/visits/${visitId}/document`, "_blank")}>
          <FileText className="h-4 w-4 me-1" /> PDF
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ minHeight: "70vh" }}>
        {html ? (
          <iframe srcDoc={html} title={t("visitReportTitle")} sandbox="allow-same-origin" className="h-[80vh] w-full border-0" />
        ) : (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            {error ? <p className="text-red-600">{error}</p> : <><Loader2 className="h-6 w-6 animate-spin" /> {t("visitReportLoading")}</>}
          </div>
        )}
      </div>
    </div>
  );
}
