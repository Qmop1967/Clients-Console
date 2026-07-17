"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2, Send, Check, X, AlertTriangle, Trash2, ArrowRight,
  Clock, ShieldCheck, MessageCircle, PackageCheck, Ban, Handshake,
  Plus, Search, Package, CheckCheck,
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

const LINE_STATUS_UI: Record<string, { label: string; cls: string; border: string }> = {
  pending:     { label: "قيد المراجعة", cls: "bg-gray-500/15 text-gray-300", border: "border-s-white/15" },
  approved:    { label: "موافَق ✓",      cls: "bg-emerald-500/15 text-emerald-400", border: "border-s-emerald-500/70" },
  objected:    { label: "معترَض عليه",   cls: "bg-amber-500/15 text-amber-400", border: "border-s-amber-500/70" },
  rejected:    { label: "طلب حذف",       cls: "bg-red-500/15 text-red-400", border: "border-s-red-500/70" },
  rep_revised: { label: "عدّله المندوب", cls: "bg-blue-500/15 text-blue-400", border: "border-s-blue-500/70" },
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

/** Render Odoo HTML message bodies as plain text (no HTML injection). */
function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function nItems(n: number): string {
  if (n === 1) return "بند واحد";
  if (n === 2) return "بندين";
  if (n <= 10) return `${n} بنود`;
  return `${n} بنداً`;
}

type ConfirmState = { type: "delete"; line: Line } | { type: "cancel" } | null;

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
  const [imgErr, setImgErr] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
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

  // Close confirm dialog with Escape
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmState(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmState]);

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

  const cPending = linesArr.filter((l) => l.lineStatus === "pending").length;
  const cApproved = linesArr.filter((l) => l.lineStatus === "approved").length;
  const cObjected = linesArr.filter((l) => l.lineStatus === "objected").length;
  const cRevised = linesArr.filter((l) => l.lineStatus === "rep_revised").length;
  const reviewed = linesArr.length - cPending;
  const allApproved = linesArr.length > 0 && cApproved === linesArr.length;
  const myTurn = st === "awaiting_customer";
  const liveState = st === "awaiting_customer" || st === "awaiting_rep";
  const roundNo = (view?.counter?.roundCount || view?.rounds?.length || 0) + 1;

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(""), 2600); }

  async function bulkApprove() {
    const pend = linesArr.filter((l) => l.lineStatus === "pending");
    if (!pend.length) return;
    for (const l of pend) {
      const ok = await act(`/line/${l.id}/approve`, {}, "bulk");
      if (!ok) return;
    }
    showFlash(`تمت الموافقة على ${nItems(pend.length)}`);
  }

  function objPctHint(line: Line): { txt: string; cls: string } | null {
    const v = parseFloat(objPrice);
    if (!v || !isFinite(v) || !line.priceUnit) return null;
    const d = Math.round((1 - v / line.priceUnit) * 100);
    if (d > 0) return { txt: `أقل بـ ${d}% من السعر الحالي (${fmtMoney(line.priceUnit, cur)})`, cls: "text-emerald-400" };
    if (d < 0) return { txt: `أعلى بـ ${Math.abs(d)}% من السعر الحالي (${fmtMoney(line.priceUnit, cur)})`, cls: "text-red-400" };
    return { txt: "مطابق للسعر الحالي", cls: "text-gray-400" };
  }

  // ————— sub-renders —————

  const sendMicro = (() => {
    const parts: string[] = [];
    if (cObjected > 0) parts.push(cObjected === 1 ? "لديك اعتراض واحد" : `لديك ${cObjected} اعتراضات`);
    if (cPending > 0) parts.push(cPending === 1 ? "بند غير مراجَع" : `${cPending} بنود غير مراجَعة`);
    return parts.length ? `${parts.join(" و")} — الإرسال ينقل الدور للمندوب` : "ينقل الدور للمندوب لمراجعة ردّك";
  })();
  const confirmMicro = allApproved
    ? "كل البنود موافَق عليها — التأكيد يقفل التفاوض"
    : "سيؤكَّد العرض بالأسعار الحالية كما هي";

  function renderCtas(compact: boolean) {
    return (
      <>
        <div className={compact ? "flex gap-2" : "flex flex-col gap-2"}>
          {p.canCommitRound && (
            <button onClick={() => act("/round", { idempotency_key: `round-${orderId}-${view?.order?.x_revision_number}` }, "round", "أُرسل ردّك للمندوب")}
              disabled={busy === "round"}
              className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${
                allApproved
                  ? "bg-white/5 border border-white/15 text-gray-200 hover:bg-white/10"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}>
              {busy === "round" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} أرسل ردّي للمندوب
            </button>
          )}
          {p.canCustomerConfirm && (
            <button onClick={() => act("/customer-confirm", { idempotency_key: `confirm-${orderId}-${view?.order?.x_revision_number}` }, "confirm", "تم إرسال تأكيدك ✅")}
              disabled={busy === "confirm"}
              className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60 ${
                allApproved
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              }`}>
              {busy === "confirm" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} تأكيد العرض
            </button>
          )}
        </div>
        {!compact && p.canCommitRound && <p className="text-[11px] text-gray-500 text-center -mt-0.5">{sendMicro}</p>}
        {!compact && p.canCustomerConfirm && <p className="text-[11px] text-gray-500 text-center">{confirmMicro}</p>}
        {p.canCancel && (
          <button onClick={() => setConfirmState({ type: "cancel" })}
            disabled={busy === "cancel"}
            className="w-full py-2 text-sm text-red-400/80 hover:text-red-300 flex items-center justify-center gap-1">
            <Ban className="w-4 h-4" /> إلغاء التفاوض
          </button>
        )}
      </>
    );
  }

  function renderSummaryCard() {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold text-gray-200">ملخص العرض</p>
          <span className="text-[10px] text-gray-500 border border-white/10 rounded-full px-2 py-0.5">يُحدَّث لحظياً</span>
        </div>
        {savings > 0.009 && (
          <div className="flex items-center justify-between text-xs text-gray-500 py-1">
            <span>العرض قبل التفاوض</span>
            <span dir="ltr" className="line-through">{fmtMoney(grandTotal + savings, cur)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-dashed border-white/10 pt-2 mt-1">
          <span className="text-sm font-bold text-white">المجموع الحالي</span>
          <span dir="ltr" className="text-xl font-extrabold text-emerald-300">{fmtMoney(grandTotal, cur)}</span>
        </div>
        {savings > 0.009 && (
          <p className="text-[11px] text-emerald-400 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
            وفّرت <span dir="ltr" className="font-semibold">{fmtMoney(savings, cur)}</span> منذ بداية التفاوض 🎉
          </p>
        )}
        {linesArr.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
              <span>تقدم المراجعة</span>
              <span>{reviewed} من {nItems(linesArr.length)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${linesArr.length ? Math.round((reviewed / linesArr.length) * 100) : 0}%` }} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {cApproved > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400">{cApproved} موافَق</span>}
              {cObjected > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400">{cObjected} معترَض</span>}
              {cRevised > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400">{cRevised} معدَّل</span>}
              {cPending > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-gray-500/15 text-gray-300">{cPending} قيد المراجعة</span>}
            </div>
          </div>
        )}
        {myTurn && (
          <div className="hidden lg:flex flex-col gap-2 mt-4">
            {renderCtas(false)}
          </div>
        )}
      </div>
    );
  }

  function renderChatCard() {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-200 mb-2">
          <MessageCircle className="w-4 h-4 text-emerald-400" /> المحادثة
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
          {(view?.messages || []).length === 0 && <p className="text-xs text-gray-500 py-2">لا توجد رسائل بعد.</p>}
          {(view?.messages || []).map((m, i) => (
            <div key={i} className="text-sm bg-white/5 rounded-xl px-3 py-2">
              <div className="text-[11px] text-gray-500 mb-0.5">{m.author}</div>
              <div className="text-gray-200 whitespace-pre-line break-words">{htmlToText(m.body)}</div>
            </div>
          ))}
        </div>
        {p.canMessage && !locked && (
          <div className="flex gap-2">
            <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="اكتب رسالة..."
              className="flex-1 min-w-0 text-sm rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-gray-500 outline-none focus:border-emerald-500/40" />
            <button onClick={async () => { if (!chatText.trim()) return; const ok = await act("/message", { message: chatText.trim() }, "chat"); if (ok) setChatText(""); }}
              disabled={busy === "chat"} className="px-4 rounded-xl bg-emerald-600 text-white disabled:opacity-60">
              {busy === "chat" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
          </div>
        )}
      </div>
    );
  }

  function renderRoundsCard() {
    if (!(view?.rounds || []).length) return null;
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
        <div className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-400" /> جولات التفاوض
        </div>
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
    );
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl lg:max-w-[1440px] pb-44 lg:pb-12">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => router.back()} className="p-2 -mr-2 rounded-lg hover:bg-white/5 text-gray-400">
          <ArrowRight className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Handshake className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-bold text-white">غرفة التفاوض</h1>
        </div>
        {liveState && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" dir="ltr">
            <span dir="rtl">الجولة {roundNo}</span>
          </span>
        )}
        <span className="text-xs text-gray-500 ms-auto flex items-center gap-2">
          {liveState && (
            <span className="flex items-center gap-1.5 text-emerald-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> مباشر
            </span>
          )}
          <span dir="ltr">{view?.order?.name}</span>
        </span>
      </div>

      {/* State banner */}
      <div className={`rounded-2xl border px-4 py-3 mb-4 ${ui.cls}`}>
        <div className="flex items-center gap-2 font-bold text-sm flex-wrap">
          {st === "awaiting_customer" && <Clock className="w-4 h-4" />}
          {st === "pending_admin" && <ShieldCheck className="w-4 h-4" />}
          {st === "confirmed" && <PackageCheck className="w-4 h-4" />}
          {st === "cancelled" && <Ban className="w-4 h-4" />}
          {ui.label}
          {st !== "none" && linesArr.length > 0 && (
            <span className="ms-auto hidden sm:flex flex-wrap gap-1.5 font-normal">
              {cApproved > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400">{cApproved} موافَق</span>}
              {cObjected > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400">{cObjected} معترَض</span>}
              {cRevised > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-400">{cRevised} معدَّل</span>}
              {cPending > 0 && <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-gray-500/15 text-gray-300">{cPending} قيد المراجعة</span>}
            </span>
          )}
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
          className="w-full max-w-xl mx-auto py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 mb-4 disabled:opacity-60"
        >
          {busy === "start" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Handshake className="w-5 h-5" />}
          افتح غرفة التفاوض
        </button>
      )}

      {st !== "none" && (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_384px] lg:gap-6 lg:items-start">

          {/* Main column: lines + add product */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-bold text-gray-200">بنود العرض <span className="text-gray-500 font-normal text-xs">{nItems(linesArr.length)}</span></p>
              {myTurn && p.canApproveLine && cPending > 0 && (
                <button onClick={bulkApprove} disabled={busy === "bulk"}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 disabled:opacity-60">
                  {busy === "bulk" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
                  موافقة على المتبقي ({cPending})
                </button>
              )}
            </div>

            <div className="space-y-3 mb-5">
              {linesArr.map((l) => {
                const ls = LINE_STATUS_UI[l.lineStatus] || LINE_STATUS_UI.pending;
                const canActOnLine = myTurn;
                const priceChanged = l.originalPrice > 0 && Math.abs(l.originalPrice - l.priceUnit) > 0.009;
                const dropPct = priceChanged ? Math.round((1 - l.priceUnit / l.originalPrice) * 100) : 0;
                const isReviewed = l.lineStatus !== "pending";
                const showActions = canActOnLine && (!isReviewed || expanded[l.id]);
                const hint = objLine === l.id ? objPctHint(l) : null;
                return (
                  <div key={l.id} className={`rounded-2xl border border-white/10 border-s-[3px] ${ls.border} bg-white/[0.03] p-3`}>
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-white/5 border border-white/10 shrink-0 overflow-hidden relative">
                        {l.productId && !imgErr[l.id] ? (
                          <Image src={`/api/images/${l.productId}`} alt={l.productName || "Product"} fill sizes="44px"
                            className="object-cover" onError={() => setImgErr((s) => ({ ...s, [l.id]: true }))} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package className="w-5 h-5 text-gray-600" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate" dir="ltr">{l.productName}</p>
                        <div className="flex items-center gap-2.5 mt-1 text-xs text-gray-400 flex-wrap">
                          <span dir="ltr">×{l.quantity}</span>
                          {priceChanged ? (
                            <>
                              <span dir="ltr" className="whitespace-nowrap">
                                <span className="line-through text-gray-500">{fmtMoney(l.originalPrice, cur)}</span>
                                <span className="mx-1 text-gray-500">→</span>
                                <span className="text-white font-semibold">{fmtMoney(l.priceUnit, cur)}</span>
                              </span>
                              {dropPct > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 whitespace-nowrap" dir="ltr">
                                  −{dropPct}%
                                </span>
                              )}
                              {dropPct < 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 whitespace-nowrap" dir="ltr">
                                  +{Math.abs(dropPct)}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span dir="ltr" className="text-gray-200">{fmtMoney(l.priceUnit, cur)}</span>
                          )}
                          {l.customerAdded && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">أضفته أنت</span>}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-lg shrink-0 ${ls.cls}`}>{ls.label}</span>
                      {canActOnLine && isReviewed && !expanded[l.id] && (
                        <button onClick={() => setExpanded((s) => ({ ...s, [l.id]: true }))}
                          className="text-[11px] text-gray-500 hover:text-gray-300 shrink-0">تغيير</button>
                      )}
                    </div>

                    {(l.objectionReason || l.requestedPrice > 0) && (
                      <div className="mt-2 text-xs text-amber-300/90 bg-amber-500/5 rounded-lg px-2 py-1.5 flex items-center gap-2 flex-wrap">
                        <span>{l.objectionReason && <>اعتراض: {l.objectionReason} </>}
                        {l.requestedPrice > 0 && <span dir="ltr">— السعر المطلوب: {fmtMoney(l.requestedPrice, cur)}</span>}</span>
                        {canActOnLine && (
                          <button onClick={() => { setObjLine(l.id); setObjType(l.objectionType || "price_high"); setObjReason(l.objectionReason || ""); setObjPrice(l.requestedPrice ? String(l.requestedPrice) : ""); }}
                            className="ms-auto text-[11px] text-amber-300 underline underline-offset-2">تعديل</button>
                        )}
                      </div>
                    )}
                    {l.customerNote && (
                      <div className="mt-2 text-xs text-gray-300 bg-white/5 rounded-lg px-2 py-1.5">📝 {l.customerNote}</div>
                    )}

                    {showActions && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <button onClick={() => act(`/line/${l.id}/approve`, {}, `appr-${l.id}`, "تم قبول السطر")} disabled={busy === `appr-${l.id}`}
                            className="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 font-semibold">
                            {busy === `appr-${l.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {l.lineStatus === "rep_revised" ? "موافق على السعر الجديد" : "موافق"}</button>
                          <button onClick={() => { setObjLine(objLine === l.id ? null : l.id); setObjType(l.objectionType || "price_high"); setObjReason(l.objectionReason || ""); setObjPrice(l.requestedPrice ? String(l.requestedPrice) : ""); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20">اعتراض</button>
                          <button onClick={() => { setNoteLine(noteLine === l.id ? null : l.id); setNoteText(l.customerNote || ""); }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10">ملاحظة</button>
                          {p.canRemoveLine && (
                            <button onClick={() => setConfirmState({ type: "delete", line: l })} disabled={busy === `rm-${l.id}`}
                              title="حذف من العرض"
                              className="ms-auto text-xs p-2 rounded-lg text-red-400/80 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/25">
                              {busy === `rm-${l.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          )}
                        </div>

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
                            {hint && <p className={`text-[11px] ${hint.cls}`}>{hint.txt}</p>}
                            <div className="flex gap-2">
                              <button onClick={async () => { const ok = await act(`/line/${l.id}/object`, { objection_type: objType, objection_reason: objReason, requested_price: objPrice || undefined }, `obj-${l.id}`, "سُجّل اعتراضك"); if (ok) setObjLine(null); }}
                                disabled={busy === `obj-${l.id}`}
                                className="flex-1 text-sm py-2 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-60">
                                {busy === `obj-${l.id}` ? "..." : "حفظ الاعتراض"}</button>
                              <button onClick={() => setObjLine(null)} className="px-4 text-sm py-2 rounded-lg bg-white/5 text-gray-300">إلغاء</button>
                            </div>
                          </div>
                        )}

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

            {p.canAddLine && (
              <div className="mb-5">
                {!addOpen ? (
                  <button onClick={() => { setAddOpen(true); setPq(""); setPres([]); }}
                    className="w-full py-3 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-emerald-300 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500/10">
                    <Plus className="w-4 h-4" /> إضافة منتج للعرض
                  </button>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Search className="w-4 h-4 text-emerald-400 shrink-0" />
                      <input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="ابحث عن منتج بالاسم أو الرمز..."
                        className="flex-1 min-w-0 text-sm rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 outline-none focus:border-emerald-500/40" />
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
          </div>

          {/* Aside: summary + chat + rounds (sticky on desktop) */}
          <div className="lg:sticky lg:top-6 space-y-4 mt-1 lg:mt-0">
            {linesArr.length > 0 && renderSummaryCard()}
            {renderChatCard()}
            {renderRoundsCard()}
          </div>
        </div>
      )}

      {/* Mobile sticky action bar (customer's turn) */}
      {myTurn && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/95 to-transparent p-4 pt-8">
          <div className="max-w-2xl mx-auto">
            {renderCtas(true)}
          </div>
        </div>
      )}

      {/* Styled confirm dialog (replaces native confirm()) */}
      {confirmState && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmState(null)} />
          <div role="alertdialog" aria-modal="true"
            className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#12172a] p-5 shadow-2xl">
            <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-3">
              {confirmState.type === "delete" ? <Trash2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
            </div>
            {confirmState.type === "delete" ? (
              <>
                <h3 className="text-base font-bold text-white mb-1.5">حذف المنتج من العرض؟</h3>
                <p className="text-sm text-gray-300 leading-7">
                  سيُحذف <bdi dir="ltr" className="font-semibold text-white">{confirmState.line.productName}</bdi> من عرض السعر.
                </p>
                <p className="text-[11px] text-red-300/80 mt-1 mb-4">لا يمكن التراجع — يمكنك إعادة إضافته من زر «إضافة منتج» بسعر القائمة.</p>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-white mb-1.5">إلغاء التفاوض؟</h3>
                <p className="text-sm text-gray-300 leading-7 mb-4">سيُغلق التفاوض على هذا العرض ولن تتمكن من إكماله لاحقاً.</p>
              </>
            )}
            <div className="flex gap-2">
              <button autoFocus onClick={() => setConfirmState(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/15 text-gray-200 font-semibold text-sm hover:bg-white/10">
                تراجع
              </button>
              <button
                onClick={async () => {
                  if (confirmState.type === "delete") {
                    const l = confirmState.line;
                    const ok = await act(`/line/${l.id}`, { idempotency_key: `delline-${orderId}-${l.id}-${view?.order?.x_revision_number}` }, `rm-${l.id}`, "حُذف المنتج من العرض", "DELETE");
                    if (ok) setConfirmState(null);
                  } else {
                    const ok = await act("/cancel", {}, "cancel", "أُلغي التفاوض");
                    if (ok) setConfirmState(null);
                  }
                }}
                disabled={busy === "cancel" || (confirmState.type === "delete" && busy === `rm-${confirmState.line.id}`)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-60">
                {(busy === "cancel" || (confirmState.type === "delete" && busy === `rm-${confirmState.line.id}`)) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : confirmState.type === "delete" ? (
                  <><Trash2 className="w-4 h-4" /> نعم، احذف</>
                ) : (
                  <><Ban className="w-4 h-4" /> نعم، ألغِ التفاوض</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
