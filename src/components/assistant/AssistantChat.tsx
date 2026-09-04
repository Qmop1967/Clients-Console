"use client";

// TSH Storefront AI Sales Assistant — full-page chat (no modals, per TSH PWA rule).
// Talks only to /api/assistant/* (storefront proxy → gateway). Product cards, prices
// and images come from the server; nothing here invents a price.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Send, Paperclip, Mic, Square, ShoppingCart, ExternalLink,
  Sparkles, ThumbsUp, ThumbsDown, UserRound, RotateCcw, Loader2, ImageIcon, FileIcon, Check,
} from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { getOdooImageUrl } from "@/lib/odoo/client";
import { ASSISTANT_COPY, GOVERNORATES, assistantLocale } from "./i18n";
import { cn } from "@/lib/utils";

interface ProductCard {
  productId: number; name: string; sku?: string; priceDisplay: string | null; price: number | null;
  currency: string; availability: string | null; inStock: boolean; imageUrl: string | null;
}
interface QuickReply { label: string; value: string }
interface Action { type: string; payload?: any }
interface Msg {
  id: string; role: "user" | "assistant"; text: string; at: number;
  products?: ProductCard[]; quickReplies?: QuickReply[]; actions?: Action[];
  attachments?: { name: string; kind: string }[]; rating?: "up" | "down";
}
interface Upload { uploadId: string; kind: string; name: string }

const SESSION_KEY = "tsh_assistant_session_v1";

async function api(path: string, body?: any, init?: RequestInit) {
  const res = await fetch(`/api/assistant/${path}`, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : JSON.stringify(body || {}),
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export function AssistantChat({ locale }: { locale: string }) {
  const L = assistantLocale(locale);
  const t = ASSISTANT_COPY[L];
  const rtl = L !== "en";
  const router = useRouter();
  const { addItem } = useCart();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "human" | "wholesale">("none");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; });
  }, []);

  // ---- session bootstrap (resume within 24h, else new)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
      if (saved) {
        const r = await fetch(`/api/assistant/session/${saved}`).then((x) => x.json()).catch(() => null);
        if (!cancelled && r?.success && Array.isArray(r.history)) {
          setSessionId(saved);
          setMessages(r.history.map((h: any, i: number) => ({
            id: h.id || `h${i}`, role: h.role === "customer" ? "user" : "assistant", text: h.text, at: Date.parse(h.timestamp) || Date.now(),
          })));
          scrollDown(); return;
        }
        sessionStorage.removeItem(SESSION_KEY);
      }
      const r = await api("session", { locale: L, path: window.location.pathname });
      if (cancelled) return;
      if (r.ok && r.json?.sessionId) {
        sessionStorage.setItem(SESSION_KEY, r.json.sessionId);
        setSessionId(r.json.sessionId);
        setMessages([{ id: "a0", role: "assistant", text: r.json.greeting?.text || "", at: Date.now(), quickReplies: r.json.greeting?.quickReplies || [] }]);
      } else setError(r.status === 429 ? t.rateLimited : t.error);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  useEffect(scrollDown, [messages, busy, panel, scrollDown]);

  // ---- send
  const send = useCallback(async (text: string, attachments = pending) => {
    if (!sessionId || busy) return;
    const clean = text.trim();
    if (!clean && !attachments.length) return;
    setError(null);
    setInput("");
    setPending([]);
    const uid = `u${Date.now()}`;
    setMessages((m) => [...m, { id: uid, role: "user", text: clean, at: Date.now(), attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })) }]);
    setBusy(true);
    try {
      const r = await api("message", { sessionId, text: clean, locale: L, attachments: attachments.map((a) => ({ uploadId: a.uploadId })) });
      if (!r.ok) { setError(r.status === 429 ? t.rateLimited : r.json?.error || t.error); return; }
      const reply = r.json.reply || {};
      setMessages((m) => [...m, {
        id: r.json.messageId || `a${Date.now()}`, role: "assistant", text: reply.text || "", at: Date.now(),
        products: reply.products || [], quickReplies: reply.quickReplies || [], actions: reply.actions || [],
      }]);
      const acts: Action[] = reply.actions || [];
      if (acts.some((a) => a.type === "open_wholesale_verification")) setPanel("wholesale");
    } catch { setError(t.error); } finally { setBusy(false); }
  }, [sessionId, busy, pending, L, t]);

  const onChip = (qr: QuickReply) => {
    const v = qr.value;
    if (v === "__upload_image__") return fileRef.current?.click();
    if (v === "__wholesale_start__") return setPanel("wholesale");
    if (v === "__handoff__") return setPanel("human");
    if (v === "__dismiss__") return;
    if (v.startsWith("__add_to_cart__:")) {
      const id = Number(v.split(":")[1]);
      const card = messages.flatMap((m) => m.products || []).find((p) => p.productId === id);
      if (card) return addCard(card);
      return;
    }
    void send(v, []);
  };

  const addCard = (p: ProductCard) => {
    if (!p.price) return;
    const res = addItem({ item_id: String(p.productId), name: p.name, sku: p.sku || "", rate: p.price, image_url: p.imageUrl || getOdooImageUrl(p.productId, "256x256"), available_stock: p.inStock ? 999 : 0, unit: "unit" });
    if (!res.hasError) setAddedIds((s) => new Set(s).add(p.productId));
  };

  // ---- uploads
  const uploadFiles = async (files: FileList | File[]) => {
    if (!sessionId) return;
    const list = Array.from(files).slice(0, 4);
    for (const f of list) {
      if (f.size > 25 * 1024 * 1024 || (f.type.startsWith("image/") && f.size > 10 * 1024 * 1024)) { setError(t.fileTooLarge); return; }
    }
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("sessionId", sessionId);
      list.forEach((f) => fd.append("files", f, f.name));
      const r = await api("upload", fd);
      if (!r.ok) { setError(r.status === 429 ? t.rateLimited : t.error); return; }
      const ups: Upload[] = (r.json.uploads || []).map((u: any) => ({ uploadId: u.uploadId, kind: u.kind, name: u.name }));
      setPending((p) => [...p, ...ups]);
      // A lone photo ("do you have this?") or a transcribed voice note is a complete turn — send it.
      const auto = ups.length && !input.trim() && ups.every((u) => u.kind === "image" || (u.kind === "audio" && (r.json.uploads || []).find((x: any) => x.uploadId === u.uploadId)?.transcript));
      if (auto) await send("", ups);
    } catch { setError(t.error); } finally { setUploading(false); }
  };

  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) await uploadFiles([new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })]);
      };
      recRef.current = rec; rec.start(); setRecording(true);
    } catch { setError(t.micDenied); }
  };

  const rate = async (m: Msg, rating: "up" | "down") => {
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, rating } : x)));
    await api("feedback", { sessionId, messageId: m.id, rating }).catch(() => {});
  };

  const newChat = () => { sessionStorage.removeItem(SESSION_KEY); window.location.reload(); };
  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex h-[calc(100dvh-var(--header-height,3.5rem))] min-h-[420px] flex-col bg-background">
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-card/80 px-3 py-2 backdrop-blur">
        <button onClick={() => (history.length > 1 ? router.back() : router.push(`/${locale}/shop`))} aria-label={t.back} className="rounded-xl p-2 hover:bg-muted"><BackIcon className="h-5 w-5" /></button>
        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow"><Sparkles className="h-5 w-5" /></div>
          <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{t.title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{t.online} · {t.subtitle}</div>
        </div>
        <button onClick={() => setPanel(panel === "human" ? "none" : "human")} className="hidden items-center gap-1 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted sm:flex"><UserRound className="h-3.5 w-3.5" />{t.human}</button>
        <button onClick={newChat} aria-label={t.newChat} title={t.newChat} className="rounded-xl p-2 hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>
      </div>

      {/* messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:thin]">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-start [dir=ltr]:items-end" : "items-end [dir=ltr]:items-start")}>
              <div className={cn("max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm",
                m.role === "user" ? "rounded-ee-md bg-primary text-primary-foreground" : "rounded-es-md border bg-card")}>
                {m.text}
                {m.attachments?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-0.5 text-[11px]">
                        {a.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}{a.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {m.products?.length ? (
                <div className="grid w-full max-w-[96%] grid-cols-1 gap-2 sm:grid-cols-2">
                  {m.products.map((p) => (
                    <div key={p.productId} className="flex gap-3 rounded-2xl border bg-card p-2.5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl || getOdooImageUrl(p.productId, "256x256")} alt={p.name} loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-xl border bg-white object-contain" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="line-clamp-2 text-[13px] font-semibold" dir="ltr">{p.name}</div>
                        {p.sku ? <div className="text-[11px] text-muted-foreground" dir="ltr">{p.sku}</div> : null}
                        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                          <div>
                            {p.priceDisplay ? <div className="text-[15px] font-bold text-primary" dir="ltr">{p.priceDisplay}</div> : null}
                            <div className={cn("text-[11px]", p.inStock ? "text-emerald-600" : "text-red-500")}>{p.availability || (p.inStock ? t.inStock : t.outOfStock)}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/${locale}/shop/${p.productId}`} aria-label={t.openProduct} title={t.openProduct} className="rounded-lg border p-1.5 hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /></Link>
                            <button onClick={() => addCard(p)} disabled={!p.price || !p.inStock}
                              className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium", addedIds.has(p.productId) ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground disabled:opacity-40")}>
                              {addedIds.has(p.productId) ? <><Check className="h-3.5 w-3.5" />{t.added}</> : <><ShoppingCart className="h-3.5 w-3.5" />{t.addToCart}</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {m.role === "assistant" && m.quickReplies?.length ? (
                <div className="flex max-w-[96%] flex-wrap gap-1.5">
                  {m.quickReplies.map((q, i) => (
                    <button key={i} onClick={() => onChip(q)} disabled={busy}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[12.5px] text-primary transition hover:bg-primary/10 disabled:opacity-50">{q.label}</button>
                  ))}
                </div>
              ) : null}

              {m.role === "assistant" && m.id !== "a0" ? (
                <div className="flex gap-1 opacity-60">
                  <button onClick={() => rate(m, "up")} aria-label={t.helpful} className={cn("rounded-md p-1 hover:bg-muted", m.rating === "up" && "text-emerald-600")}><ThumbsUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => rate(m, "down")} aria-label={t.notHelpful} className={cn("rounded-md p-1 hover:bg-muted", m.rating === "down" && "text-red-500")}><ThumbsDown className="h-3.5 w-3.5" /></button>
                </div>
              ) : null}
            </div>
          ))}

          {busy ? (
            <div className="flex items-end"><div className="rounded-2xl rounded-es-md border bg-card px-4 py-2.5 text-[13px] text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.thinking}</span></div></div>
          ) : null}

          {panel === "human" ? <HumanPanel t={t} sessionId={sessionId} onDone={(msg) => { setPanel("none"); setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: msg, at: Date.now() }]); }} onCancel={() => setPanel("none")} /> : null}
          {panel === "wholesale" ? <WholesalePanel t={t} L={L} sessionId={sessionId} onDone={(msg) => { setPanel("none"); setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: msg, at: Date.now() }]); }} onCancel={() => setPanel("none")} /> : null}

          {error ? <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}
        </div>
      </div>

      {/* composer */}
      <div className="shrink-0 border-t bg-card/90 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur">
        {pending.length ? (
          <div className="mx-auto mb-1.5 flex max-w-2xl flex-wrap gap-1.5 px-1">
            {pending.map((u) => <span key={u.uploadId} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px]">{u.kind === "image" ? <ImageIcon className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}{u.name} · {t.uploaded}</span>)}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-2xl items-end gap-1.5">
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={!sessionId || uploading} aria-label={t.attach} title={t.attach} className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted disabled:opacity-40">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}</button>
          <button onClick={toggleRecord} disabled={!sessionId} aria-label={recording ? t.stop : t.record} title={recording ? t.stop : t.record} className={cn("rounded-xl p-2.5 hover:bg-muted disabled:opacity-40", recording ? "animate-pulse text-red-500" : "text-muted-foreground")}>{recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={t.placeholder}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={() => void send(input)} disabled={!sessionId || busy || (!input.trim() && !pending.length)} aria-label={t.send}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow disabled:opacity-40"><Send className={cn("h-5 w-5", rtl && "-scale-x-100")} /></button>
        </div>
        <div className="mx-auto mt-1 flex max-w-2xl items-center justify-between px-1 text-[10.5px] text-muted-foreground">
          <span>{t.poweredBy}</span>
          <button onClick={() => setPanel("human")} className="sm:hidden underline">{t.human}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inline panels (no modals)
function HumanPanel({ t, sessionId, onDone, onCancel }: { t: any; sessionId: string | null; onDone: (m: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" />{t.humanTitle}</div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{t.humanHint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} inputMode="tel" dir="ltr" className="rounded-xl border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={busy || !sessionId} onClick={async () => { setBusy(true); const r = await api("handoff", { sessionId, reason: "customer_request", contact: { name, phone } }); setBusy(false); onDone(r.json?.message || t.error); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendRequest}</button>
        <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">{t.cancel}</button>
      </div>
    </div>
  );
}

function WholesalePanel({ t, L, sessionId, onDone, onCancel }: { t: any; L: "ar" | "en" | "ckb"; sessionId: string | null; onDone: (m: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState<"email" | "otp" | "details" | "docs">("email");
  const [email, setEmail] = useState(""); const [code, setCode] = useState("");
  const [shop, setShop] = useState(""); const [owner, setOwner] = useState(""); const [phone, setPhone] = useState(""); const [gov, setGov] = useState("IQ-BG"); const [address, setAddress] = useState("");
  const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<any>) => { setBusy(true); setErr(null); try { await fn(); } catch (e: any) { setErr(e?.message || t.error); } finally { setBusy(false); } };
  const check = (r: any) => { if (!r.ok || r.json?.success === false) throw new Error(r.json?.error || t.error); return r.json; };
  const govs = useMemo(() => GOVERNORATES, []);
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-1 text-sm font-semibold">{t.wsTitle}</div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{t.wsIntro}</p>
      <div className="mb-3 flex gap-1">{["email", "otp", "details", "docs"].map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", ["email", "otp", "details", "docs"].indexOf(step) >= i ? "bg-primary" : "bg-muted")} />)}</div>
      {step === "email" ? (
        <div className="flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.wsEmail} type="email" dir="ltr" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !email.includes("@")} onClick={() => run(async () => { check(await api("wholesale/start", { sessionId, email })); setStep("otp"); })} className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{t.wsSendCode}</button>
        </div>
      ) : step === "otp" ? (
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t.wsCode} inputMode="numeric" dir="ltr" className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm tracking-widest" />
          <button disabled={busy || code.length !== 6} onClick={() => run(async () => { check(await api("wholesale/verify", { sessionId, code })); setStep("details"); })} className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{t.wsVerify}</button>
        </div>
      ) : step === "details" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder={t.wsShop} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={t.wsOwner} className="rounded-xl border bg-background px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} inputMode="tel" dir="ltr" className="rounded-xl border bg-background px-3 py-2 text-sm" />
          <select value={gov} onChange={(e) => setGov(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm">{govs.map((g) => <option key={g.code} value={g.code}>{L === "en" ? g.en : g.ar}</option>)}</select>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.wsAddress} className="rounded-xl border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <button disabled={busy || !shop || !owner || phone.replace(/\D/g, "").length < 10} onClick={() => run(async () => { check(await api("wholesale/application", { sessionId, shop_name: shop, owner_name: owner, phone, state_code: gov, address })); setStep("docs"); })} className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50 sm:col-span-2">{t.wsNext}</button>
        </div>
      ) : (
        <div className="grid gap-2">
          <label className="text-[12.5px] text-muted-foreground">{t.wsDocs}</label>
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))} className="text-sm" />
          <button disabled={busy || !files.length} onClick={() => run(async () => {
            const fd = new FormData(); fd.append("sessionId", sessionId || ""); files.forEach((f) => fd.append("files", f, f.name));
            check(await api("wholesale/documents", fd));
            const r = check(await api("wholesale/confirm", { sessionId }));
            onDone(r.message || t.wsDone);
          })} className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t.wsConfirm}</button>
        </div>
      )}
      {err ? <div className="mt-2 text-[12px] text-red-600">{err}</div> : null}
      <button onClick={onCancel} className="mt-3 text-[12px] text-muted-foreground underline">{t.cancel}</button>
    </div>
  );
}
