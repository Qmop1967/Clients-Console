"use client";

// مكتشف البطارية — the hero of the consignment experience.
// Three gates to one answer: smart text search (AR/EN), brand→family→model browse,
// and AI sticker photo analysis with a staged "digital progress" reveal.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search, Camera, Sparkles, ChevronDown, CheckCircle2, Loader2,
  Package, Send, Zap, TriangleAlert, ScanLine, Info,
} from "lucide-react";
import { ProductImageSmall } from "@/components/products";
import { getOdooImageUrl } from "@/lib/odoo/client";
import { SellOneButton } from "./sell-one-button";

interface Custody {
  consignment_id: number; consignment_name: string; line_id: number;
  qty_remaining: number; reportable_qty: number;
  invoice_unit_price: number; suggested_retail_price: number; currency_id: number;
}
interface FinderProduct {
  pp_id: number; name: string; code: string | null; pns: string[];
  image_version: number | null; confidence: "confirmed" | "likely";
  matched: { type: "laptop" | "pn"; brand?: string; family?: string; model?: string; pn?: string };
  compatible: Array<{ brand: string; family: string; model: string }>;
  multi_option: boolean;
  custody: Custody | null;
}
interface Suggestion { type: "laptop" | "pn"; label: string; laptop_id?: number; pp_id?: number; pns?: string[] }
interface TreeBrand { brand: string; families: Array<{ family: string; models: Array<{ id: number; model: string }> }> }
interface Extracted { device: string; brand: string; family: string; model: string; part_numbers: string[]; confidence: string }

const AI_STEP_DELAYS = [0, 900, 2100, 3300];

export function BatteryFinder({ firstConsignmentId }: { firstConsignmentId: number | null }) {
  const t = useTranslations("consignments");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [results, setResults] = useState<FinderProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [tree, setTree] = useState<TreeBrand[] | null>(null);
  const [treeVisible, setTreeVisible] = useState(false);
  const [brandSel, setBrandSel] = useState<string | null>(null);
  const [famSel, setFamSel] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState(-1); // -1 idle; 0..3 running; 4 done
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [noResult, setNoResult] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingReq, setSendingReq] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (debTimer.current) clearTimeout(debTimer.current);
    aiTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const applyResponse = useCallback((d: { suggestions?: Suggestion[]; results?: FinderProduct[] }, fromPick: boolean) => {
    const res = d.results || [];
    setResults(res);
    setNoResult(res.length === 0 && fromPick);
    if (!fromPick) {
      setSuggestions(d.suggestions || []);
      setShowSugg(res.length === 0 && (d.suggestions || []).length > 0);
      if (res.length === 0 && (d.suggestions || []).length === 0) setNoResult(q.trim().length >= 3);
    } else {
      setShowSugg(false);
    }
  }, [q]);

  // Debounced text search
  useEffect(() => {
    if (debTimer.current) clearTimeout(debTimer.current);
    const query = q.trim();
    if (query.length < 2) { setSuggestions([]); setShowSugg(false); setNoResult(false); return; }
    debTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/consignments/finder?q=${encodeURIComponent(query)}`);
        if (res.ok) applyResponse(await res.json(), false);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 280);
  }, [q, applyResponse]);

  const pickLaptop = async (laptopId: number) => {
    setShowSugg(false); setSearching(true); setExtracted(null);
    try {
      const res = await fetch(`/api/consignments/finder?laptop_id=${laptopId}`);
      if (res.ok) applyResponse(await res.json(), true);
    } catch { /* silent */ }
    finally { setSearching(false); }
  };

  const pickSuggestion = (s: Suggestion) => {
    setQ(s.label);
    if (s.laptop_id) void pickLaptop(s.laptop_id);
    else if (s.pns && s.pns[0]) { setQ(s.pns[0]); }
  };

  const openTree = async () => {
    setTreeVisible(v => !v);
    if (!tree) {
      try {
        const res = await fetch("/api/consignments/finder/tree");
        if (res.ok) { const d = await res.json(); setTree(d.brands || []); }
      } catch { /* silent */ }
    }
  };

  // ── AI photo flow ──
  const compress = async (file: File): Promise<{ b64: string; mime: string }> => {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read"));
      r.readAsDataURL(file);
    });
    const img = document.createElement("img");
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = dataUrl; });
    const max = 1280;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { b64: canvas.toDataURL("image/jpeg", 0.82).split(",")[1], mime: "image/jpeg" };
  };

  const onPhoto = async (file: File | null) => {
    if (!file) return;
    setResults([]); setNoResult(false); setExtracted(null); setShowSugg(false);
    aiTimers.current.forEach(clearTimeout); aiTimers.current = [];
    setAiStep(0);
    // Staged digital progress: steps advance on a clock while the AI works,
    // the last step holds until the response lands.
    for (let i = 1; i < AI_STEP_DELAYS.length; i++) {
      aiTimers.current.push(setTimeout(() => setAiStep(s => (s >= 0 && s < i ? i : s)), AI_STEP_DELAYS[i]));
    }
    try {
      const { b64, mime } = await compress(file);
      const res = await fetch("/api/consignments/finder/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, media_type: mime }),
      });
      const d = await res.json();
      aiTimers.current.forEach(clearTimeout);
      if (!res.ok) {
        setAiStep(-1);
        showToast(d?.message || t("aiFailed"));
        return;
      }
      setAiStep(4);
      setTimeout(() => {
        setExtracted(d.extracted || null);
        applyResponse(d, true);
        if ((d.results || []).length === 0) setNoResult(true);
        setAiStep(-1);
      }, 450);
    } catch {
      aiTimers.current.forEach(clearTimeout);
      setAiStep(-1);
      showToast(t("aiFailed"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── actions on results ──
  const decrementCustody = (ppId: number) => {
    setResults(rs => rs.map(r => r.pp_id === ppId && r.custody
      ? { ...r, custody: { ...r.custody, reportable_qty: Math.max(0, r.custody.reportable_qty - 1), qty_remaining: Math.max(0, r.custody.qty_remaining - 1) } }
      : r));
  };
  const incrementCustody = (ppId: number) => {
    setResults(rs => rs.map(r => r.pp_id === ppId && r.custody
      ? { ...r, custody: { ...r.custody, reportable_qty: r.custody.reportable_qty + 1, qty_remaining: r.custody.qty_remaining + 1 } }
      : r));
  };

  const orderFromRep = async (p: FinderProduct) => {
    if (!firstConsignmentId || sendingReq) return;
    setSendingReq(true);
    try {
      const res = await fetch(`/api/consignments/${firstConsignmentId}/request-topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: p.pp_id, note: "طلب توفير من مكتشف البطارية" }),
      });
      showToast(res.ok ? t("finderOrderSent") : t("errorGeneric"));
    } catch { showToast(t("errorGeneric")); }
    finally { setSendingReq(false); }
  };

  const sendSearchRequest = async () => {
    if (!firstConsignmentId || sendingReq) return;
    setSendingReq(true);
    try {
      const res = await fetch(`/api/consignments/${firstConsignmentId}/request-topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "طلب بحث توافق: " + q.slice(0, 200) }),
      });
      if (res.ok) { showToast(t("finderRequestSent")); setNoResult(false); }
      else showToast(t("errorGeneric"));
    } catch { showToast(t("errorGeneric")); }
    finally { setSendingReq(false); }
  };

  const fmt = (v: number, cur: number) => cur === 1
    ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toLocaleString("en-US");

  const aiSteps = [t("aiStep0"), t("aiStep1"), t("aiStep2"), t("aiStep3")];

  return (
    <Card className="border-violet-200 dark:border-violet-800/60 shadow-sm overflow-visible">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold">{t("finderTitle")}</h2>
            <p className="text-[11px] text-muted-foreground">{t("finderSubtitle")}</p>
          </div>
        </div>

        {/* Search box */}
        <div className="relative" ref={boxRef}>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (suggestions.length && !results.length) setShowSugg(true); }}
              placeholder={t("finderPlaceholder")}
              className="w-full rounded-xl border-2 border-input bg-background ps-9 pe-20 py-2.5 text-sm outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <div className="absolute end-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searching && <Loader2 className="h-4 w-4 animate-spin text-violet-500" />}
              <Button size="sm" variant="ghost" className="h-8 px-2 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                onClick={() => fileRef.current?.click()} title={t("finderPhotoHint")}>
                <Camera className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => void onPhoto(e.target.files?.[0] || null)} />

          {/* Suggestions dropdown */}
          {showSugg && suggestions.length > 0 && (
            <div className="absolute z-30 mt-1.5 w-full rounded-xl border bg-popover shadow-lg overflow-hidden">
              {suggestions.slice(0, 7).map((s, i) => (
                <button key={i} onClick={() => pickSuggestion(s)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 border-b last:border-b-0">
                  <span className="flex items-center gap-2 min-w-0">
                    {s.type === "laptop" ? "💻" : "🔋"}
                    <span dir="ltr" className="truncate font-medium">{s.label}</span>
                  </span>
                  {s.pns && s.pns.length > 0 && (
                    <span dir="ltr" className="text-[10px] font-bold text-violet-600 dark:text-violet-400 shrink-0">{s.pns.filter(Boolean).slice(0, 2).join(" / ")}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">{t("finderHint")}</p>

        {/* Browse + photo row */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => void openTree()}>
            {t("finderBrowse")} <ChevronDown className={"h-3.5 w-3.5 ms-1 transition-transform " + (treeVisible ? "rotate-180" : "")} />
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
            onClick={() => fileRef.current?.click()}>
            <ScanLine className="h-3.5 w-3.5 me-1" /> {t("finderPhoto")}
          </Button>
        </div>

        {/* Browse tree */}
        {treeVisible && tree && (
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <div className="flex flex-wrap gap-1.5">
              {tree.map(b => (
                <button key={b.brand} onClick={() => { setBrandSel(brandSel === b.brand ? null : b.brand); setFamSel(null); }}
                  className={"rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors " +
                    (brandSel === b.brand ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" : "bg-background hover:border-violet-300")}>
                  <span dir="ltr">{b.brand}</span>
                </button>
              ))}
            </div>
            {brandSel && (
              <div className="flex flex-wrap gap-1.5">
                {(tree.find(b => b.brand === brandSel)?.families || []).map(f => (
                  <button key={f.family} onClick={() => setFamSel(famSel === f.family ? null : f.family)}
                    className={"rounded-full border px-2.5 py-1 text-[11px] transition-colors " +
                      (famSel === f.family ? "border-violet-500 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold" : "bg-background")}>
                    <span dir="ltr">{f.family}</span>
                  </button>
                ))}
              </div>
            )}
            {brandSel && famSel && (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {(tree.find(b => b.brand === brandSel)?.families.find(f => f.family === famSel)?.models || []).map(m => (
                  <button key={m.id} onClick={() => void pickLaptop(m.id)}
                    className="rounded-lg border bg-background px-2 py-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    <span dir="ltr">{m.model}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI digital progress */}
        {aiStep >= 0 && (
          <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-xs font-bold">AI</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-violet-200/60 dark:bg-violet-900/50">
                <div className="h-full rounded-full bg-violet-500 transition-all duration-700"
                  style={{ width: String(Math.min(100, (aiStep + 1) * 25)) + "%" }} />
              </div>
            </div>
            {aiSteps.map((label, i) => (
              <div key={i} className={"flex items-center gap-2 text-xs transition-opacity " + (i <= aiStep ? "opacity-100" : "opacity-35")}>
                {i < aiStep || aiStep === 4 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                ) : i === aiStep ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500 shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                )}
                <span className={i === aiStep ? "font-semibold" : ""}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Extracted identity chip */}
        {extracted && extracted.device !== "unknown" && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-100/70 dark:bg-violet-900/30 px-3 py-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="text-muted-foreground">{t("aiDetected")}:</span>
            <b dir="ltr">{[extracted.brand, extracted.family, extracted.model].filter(Boolean).join(" ")}</b>
            {extracted.part_numbers.length > 0 && (
              <span dir="ltr" className="font-mono text-violet-700 dark:text-violet-300">{extracted.part_numbers.join(", ")}</span>
            )}
          </div>
        )}

        {/* Multi-option note */}
        {results.length > 1 && results.some(r => r.multi_option) && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-[11.5px] text-blue-700 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {t("finderMultiNote")}
          </div>
        )}

        {/* Results */}
        {results.map(p => {
          const cur = p.custody?.currency_id || 87;
          const curLabel = cur === 1 ? "USD" : "IQD";
          const retail = p.custody?.suggested_retail_price || 0;
          const cost = p.custody?.invoice_unit_price || 0;
          const profit = retail > 0 && cost > 0 ? retail - cost : 0;
          const inStock = (p.custody?.reportable_qty || 0) > 0;
          const compat = p.compatible.map(c2 => (c2.brand + " " + c2.family + " " + c2.model).replace(/\s+/g, " ")).slice(0, 8);
          return (
            <div key={p.pp_id} className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {p.matched.type === "laptop" && p.matched.model
                  ? <>{t("finderFoundFor")} <span dir="ltr">{(p.matched.brand || "") + " " + p.matched.model}</span></>
                  : t("finderFound")}
                {p.confidence === "likely" && (
                  <span className="ms-auto rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[9.5px] font-bold text-amber-700 dark:text-amber-400">{t("finderLikelyNote").split(" — ")[0]}</span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <ProductImageSmall
                  src={getOdooImageUrl(p.pp_id, "256x256", p.image_version || undefined)}
                  alt={p.name}
                  className="h-14 w-14 rounded-lg shrink-0 bg-background"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug" dir="ltr" style={{ textAlign: "start" }}>{p.name}</p>
                  {p.pns.length > 0 && (
                    <p className="mt-0.5 text-[11px] font-mono font-bold text-violet-700 dark:text-violet-300" dir="ltr">{p.pns.slice(0, 3).join(" · ")}</p>
                  )}
                </div>
              </div>
              {compat.length > 0 && (
                <p className="rounded-lg bg-background/80 border px-2.5 py-2 text-[11px] text-muted-foreground leading-relaxed">
                  <b className="text-foreground">{t("finderCompatWith")}:</b>{" "}
                  <span dir="ltr">{compat.join("، ")}</span>
                </p>
              )}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg border bg-background px-1 py-1.5">
                  <p className="text-[9.5px] text-muted-foreground">{t("finderInCustody")}</p>
                  <p className={"text-[13px] font-bold " + (inStock ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {p.custody ? (inStock ? p.custody.reportable_qty.toLocaleString("en-US") + " ✓" : t("finderOutOfStock")) : t("finderOutOfStock")}
                  </p>
                </div>
                <div className="rounded-lg border bg-background px-1 py-1.5">
                  <p className="text-[9.5px] text-muted-foreground">{t("finderYourPrice")}</p>
                  <p className="text-[13px] font-bold tabular-nums">{retail > 0 ? fmt(retail, cur) : "—"}</p>
                </div>
                <div className="rounded-lg border bg-background px-1 py-1.5">
                  <p className="text-[9.5px] text-muted-foreground">{t("finderYourProfit")}</p>
                  <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{profit > 0 ? "+" + fmt(profit, cur) : "—"}</p>
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-[10.5px] text-amber-600 dark:text-amber-500">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {t("finderCheckNote")}
              </p>
              {p.custody && inStock ? (
                <SellOneButton
                  consignmentId={p.custody.consignment_id}
                  lineId={p.custody.line_id}
                  productId={p.pp_id}
                  labels={{ sell: t("finderSellNow"), undo: t("undo"), sold: t("soldOneToast"), error: t("errorGeneric") }}
                  className="w-full"
                  showToast={showToast}
                  onOptimistic={() => decrementCustody(p.pp_id)}
                  onUndo={() => incrementCustody(p.pp_id)}
                  onCommitted={() => router.refresh()}
                />
              ) : (
                firstConsignmentId && (
                  <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={sendingReq}
                    onClick={() => void orderFromRep(p)}>
                    <Package className="h-3.5 w-3.5 me-1" /> {t("finderOrderFromRep")}
                  </Button>
                )
              )}
            </div>
          );
        })}

        {/* No result */}
        {noResult && results.length === 0 && aiStep < 0 && (
          <div className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-center space-y-2">
            <p className="text-sm font-bold">😕 {t("finderNoResult")}</p>
            <p className="text-[11.5px] text-muted-foreground">{t("finderNoResultDesc")}</p>
            {firstConsignmentId && (
              <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={sendingReq}
                onClick={() => void sendSearchRequest()}>
                <Send className="h-3.5 w-3.5 me-1" /> {t("finderSendRequest")}
              </Button>
            )}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-5 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
            <div className="rounded-xl bg-foreground text-background px-4 py-2.5 text-xs font-bold shadow-xl max-w-[92vw]">
              {toast}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
