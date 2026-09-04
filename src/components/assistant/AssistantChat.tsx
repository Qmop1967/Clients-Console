"use client";

// TSH Storefront AI Sales Assistant — full-page chat (no modals, per TSH PWA rule).
// Talks only to /api/assistant/* (storefront proxy → gateway). Product cards, prices
// and images come from the server; nothing here invents a price.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Send, Paperclip, Mic, Square, ShoppingCart, ExternalLink,
  Sparkles, ThumbsUp, ThumbsDown, UserRound, RotateCcw, Loader2, ImageIcon, FileIcon, Check, X, Trash2, ChevronDown,
} from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { getOdooImageUrl } from "@/lib/odoo/client";
import { ASSISTANT_COPY, GOVERNORATES, GREET_CHIPS, assistantLocale } from "./i18n";
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
interface Upload { uploadId: string; kind: string; name: string; previewUrl?: string; transcript?: string | null }

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.4-.1.7.1.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4 0 .1 0 .7-.2 1.1z" />
    </svg>
  );
}

const SESSION_KEY = "tsh_assistant_session_v1";
const TOKEN_KEY = "tsh_assistant_token_v1";
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };

async function api(path: string, body?: any, init?: RequestInit) {
  const token = readToken();
  const res = await fetch(`/api/assistant/${path}`, {
    method: "POST",
    headers: body instanceof FormData
      ? (token ? { "x-sfa-token": token } : undefined)
      : { "content-type": "application/json", ...(token ? { "x-sfa-token": token } : {}) },
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
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "human" | "wholesale">("none");
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [atBottom, setAtBottom] = useState(true);
  const [softKb, setSoftKb] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      atBottomRef.current = true;
      setAtBottom(true);
    });
  }, []);

  // Follow the conversation only while the visitor is already at the bottom — yanking
  // them down while they scroll back through prices is the classic chat annoyance.
  const onListScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
  }, []);

  // Touch keyboards: Enter inserts a newline (the send button is right there).
  // Physical keyboards keep Enter-to-send. Resolved after mount to keep SSR markup stable.
  useEffect(() => {
    setSoftKb(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true);
  }, []);

  // iOS overlays the software keyboard ON TOP of the fixed app shell, so the composer
  // ends up underneath it. visualViewport reports the real overlap: we shrink the chat by
  // exactly that much and (via data-kb-open) hide the bottom nav while typing.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--tsh-kb-inset", inset + "px");
      root.setAttribute("data-kb-open", inset > 120 ? "1" : "0");
      if (inset > 120 && atBottomRef.current) scrollDown();
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--tsh-kb-inset");
      root.removeAttribute("data-kb-open");
    };
  }, [scrollDown]);

  // Grow the composer with the text instead of trapping long questions in one row.
  // An empty textarea reports its WRAPPED PLACEHOLDER in scrollHeight (two lines in Arabic),
  // so the idle composer must be pinned to one row rather than measured.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    if (!input) { el.style.height = "44px"; return; }
    el.style.height = "0px";
    el.style.height = Math.min(Math.max(el.scrollHeight, 44), 128) + "px";
  }, [input]);

  // A physical keyboard means the visitor is ready to type; a touch keyboard must not
  // spring open and swallow half the screen before they have read the greeting.
  useEffect(() => { if (!softKb && sessionId) taRef.current?.focus(); }, [softKb, sessionId]);

  // ---- session bootstrap (resume within 24h, else new)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
      if (saved) {
        const tok = readToken();
        const r = await fetch(`/api/assistant/session/${saved}`, { headers: tok ? { "x-sfa-token": tok } : undefined })
          .then((x) => x.json()).catch(() => null);
        if (!cancelled && r?.success && Array.isArray(r.history)) {
          setSessionId(saved);
          setWhatsapp(r.whatsapp || null);
          const restored: Msg[] = r.history.map((h: any, i: number) => ({
            id: h.id || `h${i}`, role: h.role === "customer" ? "user" : "assistant", text: h.text, at: Date.parse(h.timestamp) || Date.now(),
          }));
          // The transcript carries no chips; re-offer the starters on a fresh-looking chat.
          const lastIdx = restored.length - 1;
          if (lastIdx >= 0 && restored[lastIdx].role === "assistant" && restored.length <= 2) {
            restored[lastIdx] = { ...restored[lastIdx], quickReplies: GREET_CHIPS[L] };
          }
          setMessages(restored);
          scrollDown(); return;
        }
        sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(TOKEN_KEY);
      }
      const r = await api("session", { locale: L, path: window.location.pathname });
      if (cancelled) return;
      if (r.ok && r.json?.sessionId) {
        sessionStorage.setItem(SESSION_KEY, r.json.sessionId);
        if (r.json.sessionToken) sessionStorage.setItem(TOKEN_KEY, r.json.sessionToken);
        setSessionId(r.json.sessionId);
        setWhatsapp(r.json.whatsapp || null);
        setMessages([{ id: "a0", role: "assistant", text: r.json.greeting?.text || "", at: Date.now(), quickReplies: r.json.greeting?.quickReplies || GREET_CHIPS[L] }]);
      } else setError(r.status === 429 ? t.rateLimited : t.error);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  useEffect(() => { if (atBottomRef.current) scrollDown(); }, [messages, busy, panel, scrollDown]);

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
      const ups: Upload[] = (r.json.uploads || []).map((u: any, i: number) => ({
        uploadId: u.uploadId, kind: u.kind, name: u.name, transcript: u.transcript ?? null,
        previewUrl: u.kind === "image" && list[i] ? URL.createObjectURL(list[i]) : undefined,
      }));
      // Photos and files stay attached to the composer so the visitor can add a question
      // and review before sending. Only a transcribed voice note is a complete turn.
      const voice = ups.filter((u) => u.kind === "audio" && u.transcript);
      const keep = ups.filter((u) => !(u.kind === "audio" && u.transcript));
      if (keep.length) setPending((p) => [...p, ...keep]);
      if (voice.length && !input.trim()) await send("", voice);
    } catch { setError(t.error); } finally { setUploading(false); }
  };

  const stopMeters = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) window.clearInterval(timerRef.current);
    rafRef.current = null; timerRef.current = null;
    audioCtxRef.current?.close().catch(() => {}); audioCtxRef.current = null;
    setLevel(0); setSeconds(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = []; cancelRef.current = false;

      // Live loudness meter drives the bars, so the visitor SEES that we are listening.
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx(); audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.75;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 3.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      timerRef.current = window.setInterval(() => setSeconds((x) => (x >= 119 ? (rec.state === "recording" && rec.stop(), x) : x + 1)), 1000);

      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false); stopMeters();
        if (cancelRef.current) { chunksRef.current = []; return; }
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 1200) await uploadFiles([new File([blob], `voice-${Date.now()}.webm`, { type: blob.type })]);
      };
      recRef.current = rec; rec.start(); setRecording(true);
    } catch { setError(t.micDenied); stopMeters(); }
  };

  const stopRecording = (cancel = false) => { cancelRef.current = cancel; recRef.current?.stop(); };
  const toggleRecord = () => (recording ? stopRecording(false) : void startRecording());
  useEffect(() => () => stopMeters(), []);

  const rate = async (m: Msg, rating: "up" | "down") => {
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, rating } : x)));
    await api("feedback", { sessionId, messageId: m.id, rating }).catch(() => {});
  };

  const newChat = () => { sessionStorage.removeItem(SESSION_KEY); window.location.reload(); };
  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      style={{ paddingBottom: "var(--tsh-kb-inset, 0px)" }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
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
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" title={t.whatsapp} aria-label={t.whatsapp}
            className="flex items-center gap-1.5 rounded-xl bg-[#25D366] px-2.5 py-1.5 text-xs font-medium text-white">
            <WhatsAppIcon className="h-4 w-4" /><span className="hidden sm:inline">{t.whatsapp}</span>
          </a>
        ) : null}
        <button onClick={() => setPanel(panel === "human" ? "none" : "human")} className="hidden items-center gap-1 rounded-xl border px-3 py-1.5 text-xs hover:bg-muted sm:flex"><UserRound className="h-3.5 w-3.5" />{t.human}</button>
        <button onClick={newChat} aria-label={t.newChat} title={t.newChat} className="rounded-xl p-2 hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>
      </div>

      {/* messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={listRef} onScroll={onListScroll} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [scrollbar-width:thin]">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
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
            <div className="flex items-start"><div className="rounded-2xl rounded-es-md border bg-card px-4 py-2.5 text-[13px] text-muted-foreground"><span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t.thinking}</span></div></div>
          ) : null}

          {panel === "human" ? <HumanPanel t={t} sessionId={sessionId} whatsapp={whatsapp} onDone={(msg) => { setPanel("none"); setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: msg, at: Date.now() }]); }} onCancel={() => setPanel("none")} /> : null}
          {panel === "wholesale" ? <WholesalePanel t={t} L={L} sessionId={sessionId} onDone={(msg) => { setPanel("none"); setMessages((m) => [...m, { id: `a${Date.now()}`, role: "assistant", text: msg, at: Date.now() }]); }} onCancel={() => setPanel("none")} /> : null}

          {error ? <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}
        </div>
      </div>
      {!atBottom ? (
        <button onClick={scrollDown} aria-label={t.jumpToLatest} title={t.jumpToLatest}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card/95 px-3 py-1.5 text-[12px] shadow-lg backdrop-blur">
          <ChevronDown className="h-3.5 w-3.5" />{t.jumpToLatest}
        </button>
      ) : null}
      </div>

      {/* composer */}
      <div className="shrink-0 border-t bg-card/90 px-2 pb-2 pt-2 backdrop-blur md:pb-[max(env(safe-area-inset-bottom),8px)]">
        {pending.length ? (
          <div className="mx-auto mb-2 flex max-w-2xl flex-wrap items-center gap-2 px-1">
            {pending.map((u) => (
              <div key={u.uploadId} className="relative flex items-center gap-2 rounded-xl border bg-muted/60 p-1.5 pe-7">
                {u.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.previewUrl} alt={u.name} className="h-12 w-12 rounded-lg border bg-white object-contain" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg border bg-background">{u.kind === "image" ? <ImageIcon className="h-5 w-5" /> : <FileIcon className="h-5 w-5" />}</span>
                )}
                <span className="max-w-[9rem] truncate text-[11px] text-muted-foreground">{u.name}</span>
                <button onClick={() => setPending((p) => p.filter((x) => x.uploadId !== u.uploadId))} aria-label={t.remove}
                  className="absolute top-1 end-1 rounded-md bg-background/90 p-0.5 text-muted-foreground hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <span className="text-[11px] text-muted-foreground">{t.attachHint}</span>
          </div>
        ) : null}

        {recording ? (
          <div className="mx-auto mb-2 flex max-w-2xl items-center gap-3 rounded-2xl border border-red-400/40 bg-red-500/5 px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
            <span className="shrink-0 font-mono text-[12px] tabular-nums text-red-500">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
            <div className="flex h-8 flex-1 items-center justify-center gap-[3px] overflow-hidden" aria-hidden>
              {Array.from({ length: 28 }).map((_, i) => {
                const wave = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.7 + seconds * 1.4));
                const h = Math.max(3, Math.min(30, 3 + level * 30 * wave));
                return <span key={i} style={{ height: `${h}px`, transition: "height 90ms linear" }} className="w-[3px] rounded-full bg-red-500/80" />;
              })}
            </div>
            <span className="shrink-0 text-[11px] text-red-500">{t.recordingNow}</span>
            <button onClick={() => stopRecording(true)} aria-label={t.cancel} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            <button onClick={() => stopRecording(false)} className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-medium text-white">{t.stop}</button>
          </div>
        ) : null}
        <div className={cn("mx-auto flex max-w-2xl items-end gap-1.5", recording && "pointer-events-none opacity-40")}>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} disabled={!sessionId || uploading} aria-label={t.attach} title={t.attach} className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted disabled:opacity-40">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}</button>
          <button onClick={toggleRecord} disabled={!sessionId} aria-label={recording ? t.stop : t.record} title={recording ? t.stop : t.record} className={cn("rounded-xl p-2.5 hover:bg-muted disabled:opacity-40", recording ? "animate-pulse text-red-500" : "text-muted-foreground")}>{recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
          <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={t.placeholder}
            aria-label={t.placeholder} enterKeyHint={softKb ? "enter" : "send"}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !softKb) { e.preventDefault(); void send(input); } }}
            className="max-h-32 min-h-[44px] flex-1 resize-none overflow-y-auto rounded-2xl border bg-background px-4 py-2.5 text-[14px] leading-6 outline-none focus:ring-2 focus:ring-primary/30" />
          <button onClick={() => void send(input)} disabled={!sessionId || busy || (!input.trim() && !pending.length)} aria-label={t.send}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow disabled:opacity-40"><Send className={cn("h-5 w-5", rtl && "-scale-x-100")} /></button>
        </div>
        <div className="mx-auto mt-1 flex max-w-2xl items-center justify-between px-1 text-[10.5px] text-muted-foreground">
          <span>{t.poweredBy}</span>
          <span className="flex items-center gap-3">
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#25D366]"><WhatsAppIcon className="h-3.5 w-3.5" />{t.whatsapp}</a> : null}
            <button onClick={() => setPanel("human")} className="underline">{t.human}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- inline panels (no modals)
function HumanPanel({ t, sessionId, whatsapp, onDone, onCancel }: { t: any; sessionId: string | null; whatsapp: string | null; onDone: (m: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false); const [, setWa] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" />{t.humanTitle}</div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{t.humanHint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phone} inputMode="tel" dir="ltr" className="rounded-xl border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || !sessionId} onClick={async () => { setBusy(true); const r = await api("handoff", { sessionId, reason: "customer_request", contact: { name, phone } }); setBusy(false); if (r.json?.whatsapp) setWa(r.json.whatsapp); onDone(r.json?.message || t.error); }} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.sendRequest}</button>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-medium text-white">
            <WhatsAppIcon className="h-4 w-4" />{t.whatsappNow}
          </a>
        ) : null}
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
