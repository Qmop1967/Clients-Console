"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, Check, X, AlertTriangle, Trash2, ArrowRight,
  Clock, ShieldCheck, MessageCircle, PackageCheck, Ban, Handshake,
  Plus, Search,
} from "lucide-react";

interface Line {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  priceUnit: number;
  lineStatus: string;
  objectionType: string | null;
  objectionReason: string;
  requestedPrice: number;
  customerNote: string;
  customerAdded: boolean;
  originalPrice: number;
}
interface Round { round: number; actor: string; actorName: string; from: string; to: string; summary: string; at: string; }
interface Msg { body: string; author: string; at: string; }
interface Perms {
  canStart?: boolean; canCommitRound?: boolean; canObject?: boolean; canNote?: boolean;
  canApproveLine?: boolean; canRequestRemove?: boolean; canRemoveLine?: boolean; canAddLine?: boolean;
  canMessage?: boolean; canCustomerConfirm?: boolean; canCancel?: boolean;
}
interface View {
  success: boolean;
  order: { id: number; name: string; state: string; x_nego_state: string; x_revision_number: number; x_quote_locked: boolean; amountTotal?: number; x_price_modified: boolean; currency: string; };
  counter: { revision: number; roundCount: number };
  lines: Line[];
  rounds: Round[];
  messages: Msg[];
  permissions: Perms;
}

const STATE_UI: Record<string, { label: string; cls: string; hint: string }> = {
  none:              { label: "لم يبدأ التفاوض",        cls: "bg-gray-500/15 text-gray-300 border-gray-500/30", hint: "افتح غرفة التفاوض لمراجعة العرض والردّ عليه." },
  awaiting_customer: { label: "دورك الآن",              cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", hint: "راجع البنود — احذف أو اعترض أو أضف؛ تغييراتك تُحفظ تلقائياً. عند الانتهاء أرسل ردّك للمندوب أو أكّد العرض النهائي." },
  awaiting_rep:      { label: "بانتظار المندوب",        cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", hint: "أرسلنا ردّك للمندوب، بانتظار مراجعته." },
  pending_admin:     { label: "بانتظار موافقة الإدارة",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", hint: "العرض بسعر دون القائمة — بانتظار موافقة الإدارة." },
  confirmed:         { label: "تم التأكيد ✅",           cls: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40", hint: "تم تأكيد العرض وإقفال التفاوض." },
  cancelled:         { label: "أُلغي التفاوض",          cls: "bg-red-500/15 text-red-400 border-red-500/30", hint: "تم إلغاء هذا التفاوض." },
  admin_rejected:    { label: "أُعيد للمندوب",           cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", hint: "رفضت الإدارة السعر وأعادته للمندوب للمراجعة." },
};

const LINE_STATUS_UI: Record<string, { label: string; cls: string }> = {
  pending:     { label: "قيد المراجعة", cls: "bg-gray-500/15 text-gray-300" },
  approved:    { label: "موافَق",        cls: "bg-emerald-500/15 text-emerald-400" },
  objected:    { label: "معترَض عليه",   cls: "bg-amber-500/15 text-amber-400" },
  rejected:    { label: "طلب حذف",       cls: "bg-red-500/15 text-red-400" },
  rep_revised: { label: "عدّله المندوب", cls: "bg-blue-500/15 text-blue-400" },
};

const OBJECTION_TYPES: { v: string; l: string }[] = [
  { v: "price_high", l: "السعر مرتفع" },
  { v: "qty", l: "الكمية" },
  { v: "alternative", l: "أريد بديلاً" },
  { v: "question", l: "استفسار" },
  { v: "other", l: "أخرى" },
];

function fmtMoney(n: number, cur: string): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  if (cur === "USD") return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " د.ع";
}

export default function NegotiationRoom({ orderId, currencyCode }: { orderId: number; currencyCode: string }) {
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");
  const [chatText, setChatText] = useState("");
  const [objLine, setObjLine] = useState<number | null>(null);
  const [objType, setObjType] = useState("price_high");
  const [objReason, setObjReason] = useState("");
  const [objPrice, setObjPrice] = useState("");
  const [noteLine, setNoteLine] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  // Add-product picker
  const [addOpen, setAddOpen] = useState(false);
  const [pq, setPq] = useState("");
  const [pres, setPres] = useState<{ id: number; name: string; sku: string; stock: number }[]>([]);
  const [psearching, setPsearching] = useState(false);
  const [pqty, setPqty] = useState<Record<number, string>>({});

  const cur = view?.order?.currency || currencyCode || "IQD";

  const load = useCallback(async (silent?: boolean) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`/api/orders/${orderId}/nego`, { cache: "no-store" });
      const d = await r.json();
      if (d?.success) setView(d);
      else if (!silent) setErr(d?.message || "تعذّر جلب التفاوض");
    } catch { if (!silent) setErr("تعذّر الاتصال"); }
    finally { if (!silent) setLoading(false); }
  }, [orderId]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  // Debounced product search (add-product) — /api/stock/search returns product.product (pp_id)
  useEffect(() => {
    if (!addOpen) return;
    const q = pq.trim();
    if (q.length < 2) { setPres([]); return; }
    setPsearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/stock/search?query=${encodeURIComponent(q)}`, { cache: "no-store" });
        const d = await r.json();
        const arr = Array.isArray(d?.products) ? d.products : [];
        setPres(arr.map((x: any) => ({ id: x.id, name: x.name || "", sku: x.sku || "", stock: x.qty_available ?? 0 })));
      } catch { setPres([]); }
      finally { setPsearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [pq, addOpen]);

  async function act(path: string, body: Record<string, unknown>, key: string, okMsg?: string, method: "POST" | "DELETE" = "POST"): Promise<boolean> {
    setBusy(key); setErr("");
    try {
      const rev = view?.order?.x_revision_number ?? 0;
      const r = await fetch(`/api/orders/${orderId}/nego${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision_number: rev, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.success === false) {
        const code = String(d?.code || "");
        if (code === "REVISION_MISMATCH" || code === "REVISION_REQUIRED") {
          await load(true); setBusy(null);
          showFlash("تحدّث العرض من الطرف الآخر — راجع التغييرات");
          return false;
        }
        if (code === "NOT_YOUR_TURN") await load(true);
        setErr(d?.message || code || "فشلت العملية"); setBusy(null); return false;
      }
      await load(true); if (okMsg) showFlash(okMsg); setBusy(null); return true;
    } catch { setErr("تعذّر الاتصال"); setBusy(null); return false; }
  }

  const st = view?.order?.x_nego_state || "none";
  const ui = STATE_UI[st] || STATE_UI.none;
  const p = view?.permissions || {};
  const locked = !!view?.order?.x_quote_locked;
  const linesArr = view?.lines || [];
  const lineSum = linesArr.reduce((t, l) => t + (l.priceUnit || 0) * (l.quantity || 0), 0);
  const apiTotal = view?.order?.amountTotal ?? 0;
  const grandTotal = apiTotal > 0 ? apiTotal : lineSum;
  const savings = linesArr.reduce((t, l) => t + (l.originalPrice > 0 ? (l.originalPrice - l.priceUnit) * l.quantity : 0), 0);

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(""), 2600); }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => router.back()} className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-gray-400">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-bold text-white">غرفة التفاوض</h1>
        </div>
        <span className="text-xs text-gray-500 ms-auto" dir="ltr">{view?.order?.name}</span>
      </div>

      {/* State banner */}
      <div className={`rounded-2xl border px-4 py-3 mb-4 ${ui.cls}`}>
        <div className="flex items-center gap-2 font-bold text-sm">
          {st === "awaiting_customer" && <Clock className="w-4 h-4" />}
          {st === "pending_admin" && <ShieldCheck className="w-4 h-4" />}
          {st === "confirmed" && <PackageCheck className="w-4 h-4" />}
          {st === "cancelled" && <Ban className="w-4 h-4" />}
          {ui.label}
        </div>
        <p className="text-xs mt-1 opacity-90">{ui.hint}</p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      {flash && (
        <div className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" /> {flash}
          </div>
        </div>
      )}

      {/* Start room */}
      {st === "none" && p.canStart && (
        <button
          onClick={() => act("/start", {}, "start", "فُتحت غرفة التفاوض")}
          disabled={busy === "start"}
          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 mb-4 disabled:opacity-60"
        >
          {busy === "start" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Handshake className="w-5 h-5" />}
          افتح غرفة التفاوض
        </button>
      )}

      {/* Lines */}
      {st !== "none" && (
        <div className="space-y-3 mb-5">
          {(view?.lines || []).map((l) => {
            const ls = LINE_STATUS_UI[l.lineStatus] || LINE_STATUS_UI.pending;
            const canActOnLine = st === "awaiting_customer";
            return (
              <div key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate" dir="ltr">{l.productName}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span dir="ltr">×{l.quantity}</span>
                      <span dir="ltr" className="text-gray-200">{fmtMoney(l.priceUnit, cur)}</span>
                      {l.customerAdded && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">أضفته أنت</span>}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-1 rounded-lg shrink-0 ${ls.cls}`}>{ls.label}</span>
                </div>

                {/* Existing staged annotations */}
                {(l.objectionReason || l.requestedPrice > 0) && (
                  <div className="mt-2 text-xs text-amber-300/90 bg-amber-500/5 rounded-lg px-2 py-1.5">
                    {l.objectionReason && <span>اعتراض: {l.objectionReason} </span>}
                    {l.requestedPrice > 0 && <span dir="ltr">— السعر المطلوب: {fmtMoney(l.requestedPrice, cur)}</span>}
                  </div>
                )}
                {l.customerNote && (
                  <div className="mt-2 text-xs text-gray-300 bg-white/5 rounded-lg px-2 py-1.5">📝 {l.customerNote}</div>
                )}

                {/* Per-line actions (only on customer's turn) */}
                {canActOnLine && (
                  <>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => { setObjLine(objLine === l.id ? null : l.id); setObjType(l.objectionType || "price_high"); setObjReason(l.objectionReason || ""); setObjPrice(l.requestedPrice ? String(l.requestedPrice) : ""); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/25">اعتراض</button>
                      <button onClick={() => { setNoteLine(noteLine === l.id ? null : l.id); setNoteText(l.customerNote || ""); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 border border-white/10">ملاحظة</button>
                      <button onClick={() => act(`/line/${l.id}/approve`, {}, `appr-${l.id}`, "تم قبول السطر")} disabled={busy === `appr-${l.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                        {busy === `appr-${l.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} موافق</button>
                      {p.canRemoveLine && (
                        <button onClick={() => { if (confirm(`حذف «${l.productName}» من العرض؟`)) act(`/line/${l.id}`, { idempotency_key: `delline-${orderId}-${l.id}-${view?.order?.x_revision_number}` }, `rm-${l.id}`, "حُذف المنتج من العرض", "DELETE"); }} disabled={busy === `rm-${l.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/25 flex items-center gap-1">
                        {busy === `rm-${l.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} حذف</button>
                      )}
                    </div>

                    {/* Objection inline form */}
                    {objLine === l.id && (
                      <div className="mt-3 rounded-xl bg-black/20 border border-white/10 p-3 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {OBJECTION_TYPES.map((o) => (
                            <button key={o.v} onClick={() => setObjType(o.v)}
                              className={`text-xs px-2.5 py-1 rounded-lg border ${objType === o.v ? "bg-amber-500/25 text-amber-200 border-amber-500/40" : "bg-white/5 text-gray-400 border-white/10"}`}>{o.l}</button>
                          ))}
                        </div>
                        <textarea value={objReason} onChange={(e) => setObjReason(e.target.value)} rows={2} placeholder="سبب الاعتراض (اختياري)"
                          className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 outline-none focus:border-amber-500/40" />
                        <input value={objPrice} onChange={(e) => setObjPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder="السعر الذي تريده (اختياري)" dir="ltr"
                          className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 outline-none focus:border-amber-500/40" />
                        <div className="flex gap-2">
                          <button onClick={async () => { const ok = await act(`/line/${l.id}/object`, { objection_type: objType, objection_reason: objReason, requested_price: objPrice || undefined }, `obj-${l.id}`, "سُجّل اعتراضك"); if (ok) setObjLine(null); }}
                            disabled={busy === `obj-${l.id}`}
                            className="flex-1 text-sm py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-60">
                            {busy === `obj-${l.id}` ? "..." : "حفظ الاعتراض"}</button>
                          <button onClick={() => setObjLine(null)} className="px-4 text-sm py-2 rounded-lg bg-white/5 text-gray-300">إلغاء</button>
                        </div>
                      </div>
                    )}

                    {/* Note inline form */}
                    {noteLine === l.id && (
                      <div className="mt-3 rounded-xl bg-black/20 border border-white/10 p-3 space-y-2">
                        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="ملاحظتك على هذا البند"
                          className="w-full text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 outline-none focus:border-emerald-500/40" />
                        <div className="flex gap-2">
                          <button onClick={async () => { const ok = await act(`/line/${l.id}/note`, { note: noteText }, `note-${l.id}`, "حُفظت الملاحظة"); if (ok) setNoteLine(null); }}
                            disabled={busy === `note-${l.id}`}
                            className="flex-1 text-sm py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60">
                            {busy === `note-${l.id}` ? "..." : "حفظ الملاحظة"}</button>
                          <button onClick={() => setNoteLine(null)} className="px-4 text-sm py-2 rounded-lg bg-white/5 text-gray-300">إلغاء</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {st !== "none" && linesArr.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 mb-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">المجموع الكلي للعرض</p>
            {savings > 0.009 && (
              <p className="text-[11px] text-emerald-400 mt-0.5">وفّرت <span dir="ltr" className="font-semibold">{fmtMoney(savings, cur)}</span> منذ بداية التفاوض 🎉</p>
            )}
          </div>
          <p className="text-lg font-extrabold text-white shrink-0" dir="ltr">{fmtMoney(grandTotal, cur)}</p>
        </div>
      )}

      {/* Add product (customer's turn) */}
      {st !== "none" && p.canAddLine && (
        <div className="mb-5">
          {!addOpen ? (
            <button onClick={() => { setAddOpen(true); setPq(""); setPres([]); }}
              className="w-full py-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-semibold flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> إضافة منتج للعرض
            </button>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                <input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ابحث عن منتج بالاسم أو الرمز..."
                  className="flex-1 text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 outline-none focus:border-emerald-500/40" />
                <button onClick={() => { setAddOpen(false); setPq(""); setPres([]); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/5"><X className="w-4 h-4" /></button>
              </div>
              {psearching && <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-emerald-400" /></div>}
              {!psearching && pq.trim().length >= 2 && pres.length === 0 && <p className="text-xs text-gray-500 py-2 text-center">لا نتائج</p>}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {pres.map((pr) => {
                  const q = pqty[pr.id] ?? "1";
                  return (
                    <div key={pr.id} className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/10 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate" dir="ltr">{pr.name}</p>
                        <div className="flex items-center gap-2 text-[11px]">
                          {pr.sku && <span dir="ltr" className="text-gray-500">{pr.sku}</span>}
                          <span dir="ltr" className={pr.stock > 0 ? "text-emerald-400" : "text-red-400"}>{pr.stock > 0 ? `متوفر ${pr.stock.toLocaleString("en-US")}` : "غير متوفر"}</span>
                        </div>
                      </div>
                      <input value={q} onChange={(e) => setPqty((sx) => ({ ...sx, [pr.id]: e.target.value.replace(/[^\d]/g, "") }))}
                        inputMode="numeric" dir="ltr" aria-label="الكمية"
                        className="w-14 text-center text-sm rounded-lg bg-white/5 border border-white/10 px-1 py-1.5 text-white outline-none focus:border-emerald-500/40" />
                      <button onClick={async () => {
                          const qn = Math.max(1, parseInt(q || "1") || 1);
                          const ok = await act("/line", { product_id: pr.id, quantity: qn, idempotency_key: `addline-${orderId}-${pr.id}-${view?.order?.x_revision_number}` }, `add-${pr.id}`, "تمت إضافة المنتج");
                          if (ok) { setAddOpen(false); setPq(""); setPres([]); }
                        }}
                        disabled={busy === `add-${pr.id}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold shrink-0 disabled:opacity-60">
                        {busy === `add-${pr.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : "أضف"}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat */}
      {st !== "none" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 mb-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-2">
            <MessageCircle className="w-4 h-4 text-emerald-400" /> المحادثة
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
            {(view?.messages || []).length === 0 && <p className="text-xs text-gray-500 py-2">لا توجد رسائل بعد.</p>}
            {(view?.messages || []).map((m, i) => (
              <div key={i} className="text-sm bg-white/5 rounded-xl px-3 py-2">
                <div className="text-[11px] text-gray-500 mb-0.5">{m.author}</div>
                <div className="text-gray-200" dangerouslySetInnerHTML={{ __html: m.body }} />
              </div>
            ))}
          </div>
          {p.canMessage && !locked && (
            <div className="flex gap-2">
              <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="اكتب رسالة..."
                className="flex-1 text-sm rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-gray-500 outline-none focus:border-emerald-500/40" />
              <button onClick={async () => { if (!chatText.trim()) return; const ok = await act("/message", { message: chatText.trim() }, "chat"); if (ok) setChatText(""); }}
                disabled={busy === "chat"} className="px-4 rounded-xl bg-emerald-600 text-white disabled:opacity-60">
                {busy === "chat" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
            </div>
          )}
        </div>
      )}

      {/* Rounds timeline */}
      {(view?.rounds || []).length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-300 mb-2">جولات التفاوض</div>
          <div className="space-y-2">
            {(view?.rounds || []).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-white/5 text-gray-300 flex items-center justify-center font-bold" dir="ltr">{r.round}</span>
                <div className="flex-1">
                  <span className="text-gray-200">{r.summary}</span>
                  <span className="text-gray-500 mx-1">— {r.actorName || r.actor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sticky action bar (customer's turn) */}
      {st === "awaiting_customer" && (
        <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/95 to-transparent p-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            {p.canCommitRound && (
              <button onClick={() => act("/round", { idempotency_key: `round-${orderId}-${view?.order?.x_revision_number}` }, "round", "أُرسل ردّك للمندوب")}
                disabled={busy === "round"}
                className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "round" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} أرسل ردّي للمندوب
              </button>
            )}
            {p.canCustomerConfirm && (
              <button onClick={() => act("/customer-confirm", { idempotency_key: `confirm-${orderId}-${view?.order?.x_revision_number}` }, "confirm", "تم إرسال تأكيدك ✅")}
                disabled={busy === "confirm"}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "confirm" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} تأكيد العرض
              </button>
            )}
          </div>
          {p.canCancel && (
            <div className="max-w-2xl mx-auto mt-2">
              <button onClick={() => { if (confirm("هل تريد إلغاء التفاوض؟")) act("/cancel", {}, "cancel", "أُلغي التفاوض"); }}
                disabled={busy === "cancel"} className="w-full py-2 text-sm text-red-400/80 flex items-center justify-center gap-1">
                <Ban className="w-4 h-4" /> إلغاء التفاوض
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
