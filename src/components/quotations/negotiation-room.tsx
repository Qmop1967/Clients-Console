"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Send, Check, X, AlertTriangle, Trash2, ArrowRight,
  Clock, ShieldCheck, MessageCircle, PackageCheck, Ban, Handshake,
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
  canApproveLine?: boolean; canRequestRemove?: boolean; canAddLine?: boolean;
  canMessage?: boolean; canCustomerConfirm?: boolean; canCancel?: boolean;
}
interface View {
  success: boolean;
  order: { id: number; name: string; state: string; x_nego_state: string; x_revision_number: number; x_quote_locked: boolean; x_price_modified: boolean; currency: string; };
  counter: { revision: number; roundCount: number };
  lines: Line[];
  rounds: Round[];
  messages: Msg[];
  permissions: Perms;
}

const STATE_UI: Record<string, { label: string; cls: string; hint: string }> = {
  none:              { label: "لم يبدأ التفاوض",        cls: "bg-gray-500/15 text-gray-300 border-gray-500/30", hint: "افتح غرفة التفاوض لمراجعة العرض والردّ عليه." },
  awaiting_customer: { label: "دورك الآن",              cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", hint: "راجع البنود، اعترض أو علّق أو وافق، ثم أرسل ردّك للمندوب أو أكّد العرض." },
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
  const [chatText, setChatText] = useState("");
  const [objLine, setObjLine] = useState<number | null>(null);
  const [objType, setObjType] = useState("price_high");
  const [objReason, setObjReason] = useState("");
  const [objPrice, setObjPrice] = useState("");
  const [noteLine, setNoteLine] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

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

  async function act(path: string, body: Record<string, unknown>, key: string): Promise<boolean> {
    setBusy(key); setErr("");
    try {
      const rev = view?.order?.x_revision_number ?? 0;
      const r = await fetch(`/api/orders/${orderId}/nego${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision_number: rev, ...body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d?.success === false) { setErr(d?.message || d?.code || "فشلت العملية"); setBusy(null); return false; }
      await load(true); setBusy(null); return true;
    } catch { setErr("تعذّر الاتصال"); setBusy(null); return false; }
  }

  const st = view?.order?.x_nego_state || "none";
  const ui = STATE_UI[st] || STATE_UI.none;
  const p = view?.permissions || {};
  const locked = !!view?.order?.x_quote_locked;

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

      {/* Start room */}
      {st === "none" && p.canStart && (
        <button
          onClick={() => act("/start", {}, "start")}
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
                      <button onClick={() => act(`/line/${l.id}/approve`, {}, `appr-${l.id}`)} disabled={busy === `appr-${l.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                        {busy === `appr-${l.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} موافق</button>
                      <button onClick={() => act(`/line/${l.id}/request-remove`, {}, `rm-${l.id}`)} disabled={busy === `rm-${l.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/25 flex items-center gap-1">
                        {busy === `rm-${l.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} طلب حذف</button>
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
                          <button onClick={async () => { const ok = await act(`/line/${l.id}/object`, { objection_type: objType, objection_reason: objReason, requested_price: objPrice || undefined }, `obj-${l.id}`); if (ok) setObjLine(null); }}
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
                          <button onClick={async () => { const ok = await act(`/line/${l.id}/note`, { note: noteText }, `note-${l.id}`); if (ok) setNoteLine(null); }}
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
              <button onClick={() => act("/round", { idempotency_key: `round-${orderId}-${view?.order?.x_revision_number}` }, "round")}
                disabled={busy === "round"}
                className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "round" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} أرسل ردّي للمندوب
              </button>
            )}
            {p.canCustomerConfirm && (
              <button onClick={() => act("/customer-confirm", { idempotency_key: `confirm-${orderId}-${view?.order?.x_revision_number}` }, "confirm")}
                disabled={busy === "confirm"}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                {busy === "confirm" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} تأكيد العرض
              </button>
            )}
          </div>
          {p.canCancel && (
            <div className="max-w-2xl mx-auto mt-2">
              <button onClick={() => { if (confirm("هل تريد إلغاء التفاوض؟")) act("/cancel", {}, "cancel"); }}
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
