"use client";

// Trader self-onboarding — tsh.sale/register
// Steps: 1 نوع النشاط · 2 البريد · 3 بيانات المحل · 4 الصور · 5 النتيجة
// Deliberate choices (Khaleel, 2026-09-17):
//  - The FIRST question separates a shop owner from a page seller. A page seller
//    is a TSH reseller and is sent to reseller.tsh.sale — never registered here.
//  - Email is the only verification channel.
//  - The account is opened at step 3 (consumer prices). Photos decide wholesale.
//  - Exterior + interior photos are both mandatory; a supplier invoice is optional.
//  - Progress survives a refresh or the OS camera switch (sessionStorage).

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Store, Mail, Loader2, Camera, CheckCircle2, MapPin, ShieldCheck, AlertCircle,
  ChevronRight, ChevronLeft, Globe, Building2, Receipt, ImageIcon, RefreshCw, Clock, XCircle,
} from "lucide-react";

const RESELLER_JOIN_URL = "https://reseller.tsh.sale/login?intent=join";
const DRAFT_KEY = "tsh_trader_reg_v2";
const DRAFT_TTL_MS = 6 * 3600 * 1000;

const GOVERNORATES = [
  ["baghdad", "بغداد"], ["basra", "البصرة"], ["nineveh", "نينوى"], ["erbil", "أربيل"],
  ["sulaymaniyah", "السليمانية"], ["duhok", "دهوك"], ["kirkuk", "كركوك"], ["najaf", "النجف"],
  ["karbala", "كربلاء"], ["babil", "بابل"], ["dhiqar", "ذي قار"], ["maysan", "ميسان"],
  ["wasit", "واسط"], ["qadisiyyah", "القادسية"], ["muthanna", "المثنى"], ["anbar", "الأنبار"],
  ["diyala", "ديالى"], ["saladin", "صلاح الدين"],
] as const;

const BUSINESS_TYPES = [
  ["maintenance", "محل صيانة"], ["retail", "محل بيع مفرد"], ["wholesale", "تاجر جملة"],
  ["electronics_office", "مكتب إلكترونيات / كمبيوتر"], ["other", "غير ذلك"],
] as const;

type Step = "type" | "reseller" | "email" | "code" | "details" | "photos" | "done";
const STEP_INDEX: Record<Step, number> = { type: 0, reseller: 0, email: 1, code: 1, details: 2, photos: 3, done: 4 };
const STEP_LABELS = ["نوع النشاط", "البريد", "بيانات المحل", "الصور", "النتيجة"];

type PhotoKind = "storefront" | "interior" | "extra_proof";
const PHOTO_SLOTS: { kind: PhotoKind; label: string; hint: string; required: boolean; Icon: any; capture: boolean }[] = [
  { kind: "storefront", label: "واجهة المحل واللافتة من الخارج", hint: "اللافتة واضحة ومقروءة", required: true, Icon: Store, capture: true },
  { kind: "interior", label: "من داخل المحل أو المكتب", hint: "الرفوف أو البضاعة أو المكتب", required: true, Icon: Building2, capture: true },
  { kind: "extra_proof", label: "فاتورة شراء من مورّد آخر أو بطاقة عمل", hint: "اختياري — يرفع نسبة الثقة كثيراً", required: false, Icon: Receipt, capture: false },
];

const EMPTY_FORM = {
  shop_name: "", owner_name: "", phone: "", governorate: "", area_text: "",
  business_type: "", sells_text: "", address_text: "", facebook_url: "", instagram_url: "",
};
type Form = typeof EMPTY_FORM;

const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const validPhone = (p: string) => /(7\d{9})$/.test(toWestern(p).replace(/\D/g, ""));

// Shrink a camera photo before upload: a 4-5 MB HEIC/JPEG becomes ~300 KB, so a
// 3G upload in a shop finishes in seconds instead of timing out.
async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

export default function RegisterPage() {
  const locale = useLocale();
  const [step, setStep] = useState<Step>("type");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Partial<Record<keyof Form, string>>>({});

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [appId, setAppId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [resendIn, setResendIn] = useState(0);

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [geo, setGeo] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [files, setFiles] = useState<Partial<Record<PhotoKind, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<PhotoKind, string>>>({});
  const restored = useRef(false);

  // ---- draft persistence (never the photos — they cannot be serialised, and
  // the OS camera round-trip is exactly what this protects against on iOS).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && Date.now() - (d.at || 0) < DRAFT_TTL_MS) {
          if (d.step) setStep(d.step === "code" ? "email" : d.step);
          setEmail(d.email || ""); setToken(d.token || ""); setAppId(d.appId ?? null);
          setForm({ ...EMPTY_FORM, ...(d.form || {}) }); setGeo(d.geo || null);
          setKnownCustomer(Boolean(d.knownCustomer)); setPartnerName(d.partnerName || "");
          setOutcome(d.outcome || "");
        }
      }
    } catch {}
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      if (step === "done" && outcome === "active_trader") { sessionStorage.removeItem(DRAFT_KEY); return; }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        at: Date.now(), step, email, token, appId, form, geo, knownCustomer, partnerName, outcome }));
    } catch {}
  }, [step, email, token, appId, form, geo, knownCustomer, partnerName, outcome]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => () => { Object.values(previews).forEach(u => u && URL.revokeObjectURL(u)); }, [previews]);

  const post = useCallback(async (path: string, body: any) => {
    const res = await fetch(`/api/trader/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      const e: any = new Error(data?.error || "حدث خطأ، حاول مرة أخرى"); e.code = data?.code; throw e;
    }
    return data;
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e: any) {
      if (e?.code === "SESSION_EXPIRED") { setToken(""); setStep("email"); }
      setError(e?.message || "حدث خطأ");
    }
    finally { setBusy(false); }
  };

  // ---- step 2: email + code
  const requestCode = () => run(async () => {
    const d = await post("otp/request", { email: email.trim() });
    setKnownCustomer(Boolean(d.known_customer));
    setCode(""); setResendIn(60); setStep("code");
  });

  const verifyCode = () => run(async () => {
    const d = await post("otp/verify", { email: email.trim(), code: toWestern(code) });
    setToken(d.token || "");
    const app = d.application || null, p = d.partner || null;
    if (p?.name) setPartnerName(p.name);
    if (app?.id) setAppId(app.id);
    // Never re-ask for what we already hold — his own earlier answers first, then
    // what Odoo knows. Not the partner name: in Odoo it is a mixed string like
    // "عمر مكتب التهاني الموصل" and seeding it as the shop name breaks the signboard match.
    setForm(f => ({
      ...f,
      shop_name: app?.shop_name || f.shop_name, owner_name: app?.owner_name || f.owner_name,
      phone: app?.phone || p?.phone || f.phone, governorate: app?.governorate || p?.governorate || f.governorate,
      area_text: app?.area_text || f.area_text, business_type: app?.business_type || f.business_type,
      sells_text: app?.sells_text || f.sells_text, address_text: app?.address_text || f.address_text,
      facebook_url: app?.facebook_url || f.facebook_url, instagram_url: app?.instagram_url || f.instagram_url,
    }));
    switch (d.next) {
      case "active_trader": setOutcome("active_trader"); setStep("done"); return;
      case "in_review":     setOutcome("in_review");     setStep("done"); return;
      case "rejected":      setOutcome("rejected");      setStep("done"); return;
      case "resume_photos": setStep("photos"); return;
      default:              setStep("details");
    }
  });

  // ---- step 3: details
  const validateDetails = (): boolean => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (form.shop_name.trim().length < 2) e.shop_name = "اكتب اسم المحل كما هو على اللافتة";
    if (form.owner_name.trim().length < 3) e.owner_name = "اكتب الاسم الكامل";
    if (!validPhone(form.phone)) e.phone = "رقم عراقي مثل 07701234567";
    if (!form.governorate) e.governorate = "اختر المحافظة";
    if (form.area_text.trim().length < 2) e.area_text = "اكتب المنطقة أو أقرب نقطة دالة";
    if (!form.business_type) e.business_type = "اختر نوع النشاط";
    setFieldErr(e);
    return Object.keys(e).length === 0;
  };

  const askLocation = () => {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      p => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGeoBusy(false); },
      () => setGeoBusy(false),               // denial is fine — never block on it
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submitDetails = () => {
    if (!validateDetails()) { setError("أكمل الحقول المعلّمة بالأحمر"); return; }
    run(async () => {
      const d = await post("application", {
        token, ...form, phone: toWestern(form.phone),
        geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, geo_accuracy_m: geo?.acc ?? null,
      });
      setAppId(d.application_id);
      if (d.status === "verified") { setOutcome("active_trader"); setStep("done"); return; }
      setStep("photos");
    });
  };

  // ---- step 4: photos
  const pickFile = async (kind: PhotoKind, f?: File) => {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { setError("اختر صورة فقط"); return; }
    setError(null);
    const small = await compressImage(f);
    setFiles(prev => ({ ...prev, [kind]: small }));
    setPreviews(prev => {
      if (prev[kind]) URL.revokeObjectURL(prev[kind]!);
      return { ...prev, [kind]: URL.createObjectURL(small) };
    });
  };
  const clearFile = (kind: PhotoKind) => {
    setFiles(prev => { const n = { ...prev }; delete n[kind]; return n; });
    setPreviews(prev => { if (prev[kind]) URL.revokeObjectURL(prev[kind]!); const n = { ...prev }; delete n[kind]; return n; });
  };
  const photosReady = PHOTO_SLOTS.every(s => !s.required || files[s.kind]);

  const submitPhotos = () => run(async () => {
    if (!appId) throw new Error("الطلب غير جاهز، ارجع خطوة وأعد الحفظ");
    if (!photosReady) throw new Error("صورة الواجهة وصورة الداخل مطلوبتان");
    const fd = new FormData();
    fd.append("token", token);
    for (const s of PHOTO_SLOTS) {
      const f = files[s.kind];
      if (f) { fd.append("files", f, f.name); fd.append("kinds", s.kind); }
    }
    const res = await fetch(`/api/trader/application/${appId}/documents`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      const e: any = new Error(data?.error || "تعذّر رفع الصور"); e.code = data?.code; throw e;
    }
    setOutcome(data.status === "verified" ? "verified" : data.status === "needs_more" ? "needs_more" : "in_review");
    setStep("done");
  });

  const restart = () => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    setStep("type"); setEmail(""); setCode(""); setToken(""); setAppId(null); setOutcome("");
    setForm(EMPTY_FORM); setGeo(null); setFiles({}); setPreviews({}); setError(null); setFieldErr({});
  };

  const stepIdx = STEP_INDEX[step];
  const field = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [k]: e.target.value });
      if (fieldErr[k]) setFieldErr({ ...fieldErr, [k]: undefined });
    },
  });
  const errCls = (k: keyof Form) => fieldErr[k] ? "border-red-400 focus-visible:ring-red-400" : "";
  const selectCls = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900";
  const FieldError = ({ k }: { k: keyof Form }) => fieldErr[k]
    ? <p className="text-xs text-red-600 dark:text-red-400">{fieldErr[k]}</p> : null;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/${locale}/login`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <ChevronRight className="h-4 w-4" /> تسجيل الدخول
          </Link>
          <span className="text-xs font-bold tracking-wide text-slate-400">TSH</span>
        </div>

        {/* Stepper */}
        <ol className="mb-5 grid grid-cols-5 gap-1">
          {STEP_LABELS.map((label, i) => {
            const state = i < stepIdx ? "done" : i === stepIdx ? "current" : "todo";
            return (
              <li key={label} className="flex flex-col items-center gap-1.5">
                <div className={`h-1.5 w-full rounded-full ${state === "todo" ? "bg-slate-200 dark:bg-slate-800" : "bg-blue-600"}`} />
                <span className={`text-[11px] leading-none ${state === "current" ? "font-bold text-blue-700 dark:text-blue-400"
                  : state === "done" ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
            </div>
          )}

          {/* ---------------------------------------------------------------- 1. type */}
          {step === "type" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold">فتح حساب تاجر</h1>
                <p className="mt-1 text-sm text-slate-500">سؤال واحد أولاً حتى نوجّهك للمسار الصحيح.</p>
              </div>
              <p className="text-base font-semibold">هل عندك محل أو مكتب فعلي يستقبل زبائن؟</p>
              <button type="button" onClick={() => { setError(null); setStep("email"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-slate-200 p-4 text-right transition hover:border-blue-600 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:bg-blue-950/30">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><Store className="h-6 w-6" /></span>
                <span className="flex-1">
                  <span className="block font-bold">نعم، عندي محل أو مكتب</span>
                  <span className="block text-sm text-slate-500">محل صيانة، بيع مفرد، جملة، أو مكتب إلكترونيات</span>
                </span>
                <ChevronLeft className="h-5 w-5 text-slate-400" />
              </button>
              <button type="button" onClick={() => { setError(null); setStep("reseller"); }}
                className="flex w-full items-center gap-4 rounded-xl border-2 border-slate-200 p-4 text-right transition hover:border-emerald-600 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:bg-emerald-950/30">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Globe className="h-6 w-6" /></span>
                <span className="flex-1">
                  <span className="block font-bold">لا، أبيع عبر صفحة أو حساب فقط</span>
                  <span className="block text-sm text-slate-500">فيسبوك، انستغرام، تيك توك، واتساب</span>
                </span>
                <ChevronLeft className="h-5 w-5 text-slate-400" />
              </button>
            </div>
          )}

          {/* ---------------------------------------------------------------- 1b. reseller */}
          {step === "reseller" && (
            <div className="space-y-4 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Globe className="h-7 w-7" /></span>
              <h2 className="text-xl font-bold">إذن أنت موزّع TSH</h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                برنامج الموزّعين مصمّم لمن يبيع عبر الصفحات: تعرض منتجاتنا لزبائنك بسعر مقترح، ونتكفّل نحن بالتجهيز والتوصيل، وربحك يُحسب لك على كل طلب.
                التسجيل يأخذ دقيقتين ولا يحتاج محلاً.
              </p>
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                <a href={RESELLER_JOIN_URL}>سجّل كموزّع في reseller.tsh.sale</a>
              </Button>
              <button type="button" onClick={() => setStep("type")} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                رجوع — عندي محل فعلاً
              </button>
            </div>
          )}

          {/* ---------------------------------------------------------------- 2. email */}
          {step === "email" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">بريدك الإلكتروني</h2>
                <p className="mt-1 text-sm text-slate-500">نرسل لك رمز تحقق. هذا البريد هو مفتاح دخولك لاحقاً.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input id="email" type="email" dir="ltr" inputMode="email" value={email}
                    onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
                    className="h-11 pr-9 text-left" autoComplete="email" autoFocus
                    onKeyDown={e => { if (e.key === "Enter" && email.includes("@")) requestCode(); }} />
                </div>
              </div>
              <Button className="h-11 w-full" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())} onClick={requestCode}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "أرسل رمز التحقق"}
              </Button>
              <button type="button" onClick={() => setStep("type")} className="w-full text-center text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">رجوع</button>
            </div>
          )}

          {/* ---------------------------------------------------------------- 2b. code */}
          {step === "code" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">أدخل رمز التحقق</h2>
                <p className="mt-1 text-sm text-slate-500">
                  أرسلناه إلى <span dir="ltr" className="font-medium text-slate-700 dark:text-slate-200">{email}</span>. تحقّق من صندوق الوارد ومجلد الرسائل غير المرغوبة.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">الرمز المكوّن من 6 أرقام</Label>
                <Input id="code" dir="ltr" inputMode="numeric" maxLength={6} value={code}
                  onChange={e => setCode(toWestern(e.target.value).replace(/\D/g, ""))}
                  placeholder="000000" autoComplete="one-time-code" autoFocus
                  className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
                  onKeyDown={e => { if (e.key === "Enter" && code.length === 6) verifyCode(); }} />
              </div>
              <Button className="h-11 w-full" disabled={busy || code.length !== 6} onClick={verifyCode}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحقّق"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep("email")} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">تغيير البريد</button>
                <button type="button" onClick={requestCode} disabled={busy || resendIn > 0}
                  className="text-blue-700 disabled:text-slate-400 dark:text-blue-400">
                  {resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ث` : "أعد إرسال الرمز"}
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- 3. details */}
          {step === "details" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">بيانات المحل</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {partnerName ? `مسجّل عندنا باسم: ${partnerName} — عبّأنا ما نعرفه، أكمل الناقص فقط.`
                    : knownCustomer ? "أنت مسجّل عندنا — أكمل بيانات المحل لفتح حساب التاجر."
                    : "تأخذ أقل من دقيقة. الحقول المعلّمة بـ * مطلوبة."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="shop">اسم المحل كما هو مكتوب على اللافتة *</Label>
                  <Input id="shop" {...field("shop_name")} className={`h-11 ${errCls("shop_name")}`} placeholder="مثال: مكتب النور للإلكترونيات" />
                  <FieldError k="shop_name" />
                  <p className="text-xs text-slate-500">نقارن هذا الاسم بصورة اللافتة، فاكتبه مطابقاً.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner">اسم صاحب المحل *</Label>
                  <Input id="owner" {...field("owner_name")} className={`h-11 ${errCls("owner_name")}`} autoComplete="name" />
                  <FieldError k="owner_name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">رقم الهاتف *</Label>
                  <Input id="phone" dir="ltr" inputMode="tel" autoComplete="tel" {...field("phone")}
                    placeholder="07XXXXXXXXX" className={`h-11 text-left ${errCls("phone")}`} />
                  <FieldError k="phone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gov">المحافظة *</Label>
                  <select id="gov" {...field("governorate")} className={`${selectCls} ${errCls("governorate")}`}>
                    <option value="">اختر</option>
                    {GOVERNORATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <FieldError k="governorate" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="area">المنطقة / أقرب نقطة دالة *</Label>
                  <Input id="area" {...field("area_text")} className={`h-11 ${errCls("area_text")}`} placeholder="مثال: الكرادة، قرب ساحة الواثق" />
                  <FieldError k="area_text" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="btype">نوع النشاط *</Label>
                  <select id="btype" {...field("business_type")} className={`${selectCls} ${errCls("business_type")}`}>
                    <option value="">اختر</option>
                    {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <FieldError k="business_type" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sells">ماذا تبيع؟ <span className="text-slate-400">(اختياري)</span></Label>
                  <Input id="sells" {...field("sells_text")} className="h-11" placeholder="مثال: شواحن، بطاريات، إكسسوارات موبايل" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="addr">العنوان التفصيلي <span className="text-slate-400">(اختياري)</span></Label>
                  <Input id="addr" {...field("address_text")} className="h-11" placeholder="الشارع، رقم المحل أو البناية" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb">صفحة فيسبوك <span className="text-slate-400">(اختياري)</span></Label>
                  <Input id="fb" dir="ltr" inputMode="url" {...field("facebook_url")} placeholder="facebook.com/..." className="h-11 text-left" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ig">حساب انستغرام <span className="text-slate-400">(اختياري)</span></Label>
                  <Input id="ig" dir="ltr" inputMode="url" {...field("instagram_url")} placeholder="instagram.com/..." className="h-11 text-left" />
                </div>
              </div>

              <button type="button" onClick={askLocation} disabled={geoBusy}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition ${geo
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
                  : "border-slate-200 hover:border-blue-500 dark:border-slate-700"}`}>
                <span className="flex items-center gap-2">
                  {geoBusy ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <MapPin className="h-4 w-4 text-blue-700 dark:text-blue-400" />}
                  {geo ? "تم تحديد موقع المحل" : "حدّد موقع المحل الآن (اختياري — يسرّع التحقق)"}
                </span>
                {geo && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </button>
              <p className="-mt-2 text-xs text-slate-500">اضغط الزر وأنت داخل المحل حتى يكون الموقع دقيقاً.</p>

              <Button className="h-11 w-full" disabled={busy} onClick={submitDetails}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ والانتقال للصور"}
              </Button>
            </div>
          )}

          {/* ---------------------------------------------------------------- 4. photos */}
          {step === "photos" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">صور المحل</h2>
                <p className="mt-1 text-sm text-slate-500">
                  بياناتك محفوظة وحسابك مفتوح. الصور هي ما يفتح لك أسعار الجملة.
                </p>
              </div>

              {PHOTO_SLOTS.map(({ kind, label, hint, required, Icon, capture }) => (
                <div key={kind} className="space-y-1.5">
                  <Label htmlFor={`f-${kind}`}>{label} {required ? <span className="text-red-500">*</span> : <span className="text-slate-400">(اختياري)</span>}</Label>
                  {previews[kind] ? (
                    <div className="relative overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previews[kind]} alt={label} className="h-44 w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                        <span className="flex items-center gap-1 text-xs"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> جاهزة</span>
                        <div className="flex gap-2">
                          <label htmlFor={`f-${kind}`} className="cursor-pointer rounded-md bg-white/20 px-2 py-1 text-xs backdrop-blur hover:bg-white/30">
                            <RefreshCw className="ml-1 inline h-3 w-3" />تغيير
                          </label>
                          <button type="button" onClick={() => clearFile(kind)} className="rounded-md bg-white/20 px-2 py-1 text-xs backdrop-blur hover:bg-white/30">حذف</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor={`f-${kind}`}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-4 text-sm transition hover:border-blue-600 hover:bg-blue-50/40 dark:border-slate-700 dark:hover:bg-blue-950/20">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800"><Icon className="h-5 w-5" /></span>
                      <span className="flex-1">
                        <span className="block font-medium text-slate-700 dark:text-slate-200">{capture ? "التقط صورة بالكاميرا" : "اختر صورة"}</span>
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                      <Camera className="h-5 w-5 text-slate-400" />
                    </label>
                  )}
                  <input id={`f-${kind}`} type="file" accept="image/*" className="hidden"
                    {...(capture ? { capture: "environment" as const } : {})}
                    onChange={e => { pickFile(kind, e.target.files?.[0]); e.target.value = ""; }} />
                </div>
              ))}

              <div className="flex gap-2 rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>التقط الصور بالكاميرا مباشرة والإضاءة جيدة. الصور المحفوظة من الإنترنت أو لقطات الشاشة تُرفض تلقائياً.</span>
              </div>

              <Button className="h-11 w-full" disabled={busy || !photosReady} onClick={submitPhotos}>
                {busy ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري الرفع والفحص…</> : "إرسال الصور للتحقق"}
              </Button>
              <button type="button" onClick={() => setStep("details")} disabled={busy}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                تعديل بيانات المحل
              </button>
            </div>
          )}

          {/* ---------------------------------------------------------------- 5. done */}
          {step === "done" && (
            <div className="space-y-4 py-2 text-center">
              {outcome === "active_trader" || outcome === "verified" ? (
                <>
                  <ShieldCheck className="mx-auto h-12 w-12 text-emerald-600" />
                  <h3 className="text-lg font-bold">{partnerName ? `أهلاً ${partnerName}` : "حسابك التجاري فعّال"}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    أسعار الجملة مفتوحة لك. سجّل دخولك ببريدك وتصفّح مباشرة.
                  </p>
                  <Button asChild className="h-11 w-full"><Link href={`/${locale}/login`}>تسجيل الدخول</Link></Button>
                </>
              ) : outcome === "needs_more" ? (
                <>
                  <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
                  <h3 className="text-lg font-bold">نحتاج صوراً أوضح</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ما قدرنا نقرأ اللافتة أو نميّز المحل من الصور. حسابك مفتوح وتقدر تتصفح، وأرسلنا لك بريداً بالمطلوب.
                  </p>
                  <Button className="h-11 w-full" onClick={() => { setFiles({}); setPreviews({}); setStep("photos"); }}>
                    <Camera className="ml-2 h-4 w-4" />إعادة التصوير الآن
                  </Button>
                </>
              ) : outcome === "rejected" ? (
                <>
                  <XCircle className="mx-auto h-12 w-12 text-slate-400" />
                  <h3 className="text-lg font-bold">تمت مراجعة طلبك سابقاً</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    لم نتمكن من تفعيل أسعار الجملة على هذا الحساب. إذا عندك محل فعلي وتعتقد أن هناك خطأ، تواصل معنا وسنعيد المراجعة.
                  </p>
                </>
              ) : (
                <>
                  <Clock className="mx-auto h-12 w-12 text-blue-600" />
                  <h3 className="text-lg font-bold">استلمنا صورك — طلبك قيد المراجعة</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    الفحص الآلي انتهى وبقي تأكيد الإدارة، غالباً خلال يوم عمل. نرسل لك النتيجة على{" "}
                    <span dir="ltr" className="font-medium">{email}</span> — ما تحتاج تعيد التسجيل.
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">حسابك مفتوح من الآن بأسعار المستهلك.</p>
                </>
              )}
              {outcome !== "active_trader" && outcome !== "verified" && (
                <Button asChild variant="outline" className="h-11 w-full">
                  <Link href={`/${locale}/login`}>تسجيل الدخول وتصفّح المنتجات</Link>
                </Button>
              )}
              <button type="button" onClick={restart} className="text-xs text-slate-400 hover:text-slate-600">بدء تسجيل جديد ببريد آخر</button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          بياناتك وصور محلك تُستخدم للتحقق فقط ولا تُنشر ولا تُشارك مع أي طرف.
        </p>
      </div>
    </div>
  );
}
