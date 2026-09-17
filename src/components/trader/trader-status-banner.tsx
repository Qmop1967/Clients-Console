"use client";

// Banner for a logged-in customer whose trader application is not settled yet.
// Khaleel (2026-09-17): a pending applicant must see, clearly, that every price on
// the page is a RETAIL price until his trader account is approved, and that the
// special wholesale prices appear after that.
//
// The session's pricelist is fixed at login, so a trader activated while logged in
// still sees retail prices until he signs in again — the green state tells him so.

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Clock, Camera, ShieldCheck, X } from "lucide-react";

const TRADER_PRICELIST_ID = "13"; // Competitive Pricing — قائمة الأسعار التنافسية
const CACHE_KEY = "tsh_trader_status_v1";
const CACHE_TTL_MS = 3 * 60 * 1000;

type TraderStatus =
  | "submitted" | "screening" | "recommended" | "on_hold" | "flagged"
  | "needs_more" | "verified" | "rejected" | null;

export function TraderStatusBanner({ locale }: { locale: string }) {
  const { data: session } = useSession();
  const partnerId = session?.user?.id ? String(session.user.id) : "";
  const priceListId = String(session?.user?.priceListId || "");
  const [status, setStatus] = useState<TraderStatus | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!partnerId) { setStatus(null); return; }
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (c?.partnerId === partnerId && Date.now() - (c.at || 0) < CACHE_TTL_MS) {
          setStatus(c.status ?? null);
          return;
        }
      }
    } catch {}
    fetch(`/api/trader/status?partner_id=${encodeURIComponent(partnerId)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const s: TraderStatus = d?.success ? (d.status ?? null) : null;
        setStatus(s);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ partnerId, status: s, at: Date.now() })); } catch {}
      })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [partnerId]);

  if (!partnerId || status === undefined || status === null || dismissed) return null;
  if (status === "rejected") return null;

  // Activated after this session was minted: prices refresh on the next sign-in.
  if (status === "verified") {
    if (priceListId === TRADER_PRICELIST_ID) return null;
    return (
      <div dir="rtl" className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="flex-1 leading-relaxed">
          <p className="font-bold">تم تفعيل حسابك كتاجر</p>
          <p>أسعار الجملة الخاصة بك جاهزة — سجّل الخروج ثم الدخول مرة أخرى حتى تظهر بدل أسعار المفرد.</p>
          <button type="button" onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
            className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
            تسجيل الخروج والدخول من جديد
          </button>
        </div>
      </div>
    );
  }

  const needsPhotos = status === "submitted" || status === "needs_more";
  return (
    <div dir="rtl" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      {needsPhotos
        ? <Camera className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        : <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
      <div className="flex-1 leading-relaxed">
        <p className="font-bold">حسابك كتاجر قيد المراجعة</p>
        <p>
          جميع الأسعار المعروضة حالياً هي <b>أسعار المفرد</b> لحين الموافقة على حساب التاجر،
          وبعدها تظهر لك <b>أسعار الجملة الخاصة</b> تلقائياً.
        </p>
        {needsPhotos && (
          <p className="mt-1">
            {status === "needs_more"
              ? "نحتاج صوراً أوضح لمحلك حتى نكمل التحقق. "
              : "بقي رفع صور المحل حتى نبدأ التحقق. "}
            <Link href={`/${locale}/register`} className="font-bold underline">ارفع الصور الآن</Link>
          </p>
        )}
      </div>
      <button type="button" onClick={() => setDismissed(true)} aria-label="إخفاء" className="rounded-md p-1 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
