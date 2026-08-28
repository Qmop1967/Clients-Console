"use client";

// Trader self-onboarding. Four steps, one page.
// Deliberate choices:
//  - The account exists after step 2. Photos are step 4, not a gate on entry —
//    a cold visitor from an ad will not upload shop photos before seeing anything.
//  - Camera capture is requested (capture="environment"); a gallery pick still
//    works but the agent scores it lower.
//  - Geolocation is optional and asked for AFTER the form, so a denial does not
//    kill the signup.

import { useState, useCallback } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Store, Mail, Loader2, Camera, CheckCircle2, MapPin, ShieldCheck, AlertCircle, ChevronLeft, Globe,
} from "lucide-react";

const GOVERNORATES = [
  ["baghdad", "بغداد"], ["basra", "البصرة"], ["nineveh", "نينوى"], ["erbil", "أربيل"],
  ["sulaymaniyah", "السليمانية"], ["duhok", "دهوك"], ["kirkuk", "كركوك"], ["najaf", "النجف"],
  ["karbala", "كربلاء"], ["babil", "بابل"], ["dhiqar", "ذي قار"], ["maysan", "ميسان"],
  ["wasit", "واسط"], ["qadisiyyah", "القادسية"], ["muthanna", "المثنى"], ["anbar", "الأنبار"],
  ["diyala", "ديالى"], ["saladin", "صلاح الدين"],
];

const BUSINESS_TYPES = [
  ["maintenance", "محل صيانة"], ["retail", "محل بيع مفرد"],
  ["wholesale", "تاجر جملة"], ["other", "غير ذلك"],
];

type Step = "email" | "code" | "details" | "photos" | "done";

export default function RegisterPage() {
  const locale = useLocale();
  const [step, setStep] = useState<Step>("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [knownCustomer, setKnownCustomer] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string>("");

  const [form, setForm] = useState({
    applicant_type: "shop", shop_name: "", owner_name: "", phone: "",
    governorate: "", business_type: "", address_text: "",
    facebook_url: "", instagram_url: "",
  });
  const isOnline = form.applicant_type === "online";
  const [geo, setGeo] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  // A page seller has no storefront. The admin view of his own page is the evidence:
  // only a real admin can open Insights / Business Suite.
  const photoSlots = isOnline
    ? ([["page_admin", "لقطة من لوحة إدارة صفحتك *"],
        ["page_extra", "لقطة إضافية (اختياري)"]] as const)
    : ([["storefront", "واجهة المحل من الخارج *"],
        ["interior", "من داخل المحل (اختياري)"]] as const);
  const requiredSlot = isOnline ? "page_admin" : "storefront";

  const post = useCallback(async (path: string, body: any) => {
    const res = await fetch(`/api/trader/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || "حدث خطأ، حاول مرة أخرى");
    return data;
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e: any) { setError(e?.message || "حدث خطأ"); }
    finally { setBusy(false); }
  };

  const requestCode = () => run(async () => {
    const d = await post("otp/request", { email });
    setKnownCustomer(Boolean(d.known_customer));
    setStep("code");
  });

  const verifyCode = () => run(async () => {
    const d = await post("otp/verify", { email, code });
    if (d.application?.status === "verified") { setOutcome("verified"); setStep("done"); return; }
    if (d.application?.id) setAppId(d.application.id);
    setStep("details");
  });

  const askLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => {},                       // denial is fine — never block on it
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submitDetails = () => run(async () => {
    const d = await post("application", {
      email, ...form,
      geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, geo_accuracy_m: geo?.acc ?? null,
    });
    setAppId(d.application_id);
    setStep("photos");
  });

  const submitPhotos = () => run(async () => {
    if (!appId) throw new Error("الطلب غير جاهز");
    if (!files[requiredSlot]) throw new Error(isOnline ? "لقطة لوحة الإدارة مطلوبة" : "صورة واجهة المحل مطلوبة");
    const fd = new FormData();
    for (const [k] of photoSlots) {
      const f = files[k];
      if (f) { fd.append("files", f); fd.append("kinds", k); }
    }
    const res = await fetch(`/api/trader/application/${appId}/documents`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.error || "تعذّر رفع الصور");
    setOutcome(data.status); setStep("done");
  });

  const canDetails = form.shop_name.trim() && form.owner_name.trim() && form.governorate
    && (!isOnline || form.facebook_url.trim() || form.instagram_url.trim());

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <Link href={`/${locale}/login`}
          className="mb-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <ChevronLeft className="h-4 w-4" /> رجوع لتسجيل الدخول
        </Link>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              <CardTitle className="text-xl">فتح حساب تاجر</CardTitle>
            </div>
            <CardDescription>
              {step === "email" && "أدخل بريدك ونرسل لك رمز دخول."}
              {step === "code" && `أرسلنا رمزاً إلى ${email}. تحقّق من صندوق الوارد ومجلد الرسائل غير المرغوبة.`}
              {step === "details" && (knownCustomer
                ? "أنت مسجّل عندنا — أكمل بيانات المحل لفتح حساب التاجر."
                : "بيانات المحل. تأخذ أقل من دقيقة.")}
              {step === "photos" && (isOnline ? "لقطة واحدة من لوحة إدارة صفحتك تكفي." : "صورة واحدة لواجهة المحل تكفي للبدء.")}
              {step === "done" && "تم استلام طلبك."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
              </div>
            )}

            {step === "email" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input id="email" type="email" dir="ltr" inputMode="email" value={email}
                      onChange={e => setEmail(e.target.value)} placeholder="name@example.com"
                      className="pr-9 text-left" autoComplete="email" />
                  </div>
                </div>
                <Button className="w-full" disabled={busy || !email.includes("@")} onClick={requestCode}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "أرسل رمز الدخول"}
                </Button>
              </>
            )}

            {step === "code" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="code">رمز الدخول</Label>
                  <Input id="code" dir="ltr" inputMode="numeric" maxLength={6} value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000" autoComplete="one-time-code"
                    className="text-center font-mono text-2xl tracking-[0.4em]" />
                </div>
                <Button className="w-full" disabled={busy || code.length !== 6} onClick={verifyCode}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "تحقّق"}
                </Button>
                <button type="button" onClick={requestCode} disabled={busy}
                  className="w-full text-center text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  لم يصلك الرمز؟ أعد الإرسال
                </button>
              </>
            )}

            {step === "details" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {([["shop", "عندي محل", Store], ["online", "عندي صفحة", Globe]] as const).map(([v, l, Icon]) => (
                    <button key={v} type="button" onClick={() => setForm({ ...form, applicant_type: v })}
                      className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition ${
                        form.applicant_type === v
                          ? "border-blue-700 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"}`}>
                      <Icon className="h-4 w-4" />{l}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="shop">{isOnline ? "اسم الصفحة *" : "اسم المحل *"}</Label>
                    <Input id="shop" value={form.shop_name}
                      onChange={e => setForm({ ...form, shop_name: e.target.value })}
                      placeholder={isOnline ? "كما هو مكتوب على الصفحة" : "كما هو مكتوب على اللافتة"} />
                    <p className="text-xs text-slate-500">
                      {isOnline ? "اكتبه مطابقاً لاسم الصفحة — نقارنه باللقطة."
                                : "اكتبه مطابقاً للافتة — نقارن الاسم بالصورة."}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="owner">اسم صاحب المحل *</Label>
                    <Input id="owner" value={form.owner_name}
                      onChange={e => setForm({ ...form, owner_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">رقم الهاتف</Label>
                    <Input id="phone" dir="ltr" inputMode="tel" value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      placeholder="07XXXXXXXXX" className="text-left" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gov">المحافظة *</Label>
                    <select id="gov" value={form.governorate}
                      onChange={e => setForm({ ...form, governorate: e.target.value })}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <option value="">اختر</option>
                      {GOVERNORATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="btype">نوع النشاط</Label>
                    <select id="btype" value={form.business_type}
                      onChange={e => setForm({ ...form, business_type: e.target.value })}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                      <option value="">اختر</option>
                      {BUSINESS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="addr">عنوان المحل</Label>
                    <Input id="addr" value={form.address_text}
                      onChange={e => setForm({ ...form, address_text: e.target.value })}
                      placeholder="المنطقة، أقرب نقطة دالة" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fb">صفحة فيسبوك {isOnline ? "" : "(اختياري)"}</Label>
                    <Input id="fb" dir="ltr" value={form.facebook_url}
                      onChange={e => setForm({ ...form, facebook_url: e.target.value })}
                      placeholder="facebook.com/..." className="text-left" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ig">حساب انستغرام {isOnline ? "" : "(اختياري)"}</Label>
                    <Input id="ig" dir="ltr" value={form.instagram_url}
                      onChange={e => setForm({ ...form, instagram_url: e.target.value })}
                      placeholder="instagram.com/..." className="text-left" />
                  </div>
                  <p className="text-xs text-slate-500 sm:col-span-2">
                    {isOnline
                      ? "رابط واحد على الأقل مطلوب — الصفحة هي هويتك التجارية."
                      : "الرابط اختياري، لكنه يسرّع التحقق كثيراً: صفحة لها تاريخ ومنشورات وتعليقات زبائن دليل أقوى من أي صورة."}
                  </p>
                </div>

                <button type="button" onClick={askLocation}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    {geo ? "تم تحديد الموقع" : "حدّد موقع المحل (يسرّع التحقق)"}
                  </span>
                  {geo && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </button>

                <Button className="w-full" disabled={busy || !canDetails} onClick={submitDetails}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "التالي"}
                </Button>
              </>
            )}

            {step === "photos" && (
              <>
                {photoSlots.map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <Label htmlFor={k}>{label}</Label>
                    <label htmlFor={k}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm hover:border-blue-600 dark:border-slate-700">
                      <Camera className="h-5 w-5 text-slate-400" />
                      <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                        {files[k]?.name || (isOnline ? "اضغط لاختيار لقطة" : "اضغط لالتقاط صورة")}
                      </span>
                      {files[k] && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </label>
                    <input id={k} type="file" accept="image/*"
                      {...(isOnline ? {} : { capture: "environment" as const })} className="hidden"
                      onChange={e => setFiles({ ...files, [k]: e.target.files?.[0] })} />
                  </div>
                ))}
                <div className="rounded-lg bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                  {isOnline
                    ? "افتح Meta Business Suite أو إحصائيات صفحتك وخذ لقطة شاشة يظهر فيها اسم الصفحة ولوحة الإدارة. هذي اللقطة لا يقدر يفتحها غير مدير الصفحة."
                    : "التقط الصورة بالكاميرا مباشرة واللافتة واضحة فيها. الصور المحفوظة من الإنترنت أو لقطات الشاشة لا تُقبل."}
                </div>
                <Button className="w-full" disabled={busy || !files[requiredSlot]} onClick={submitPhotos}>
                  {busy ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري التحقق…</> : "إرسال"}
                </Button>
              </>
            )}

            {step === "done" && (
              <div className="space-y-4 py-2 text-center">
                {outcome === "needs_more" ? (
                  <>
                    <AlertCircle className="mx-auto h-11 w-11 text-amber-500" />
                    <h3 className="text-lg font-bold">نحتاج صورة أوضح</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      حسابك مفتوح وتقدر تتصفح المنتجات الآن. أرسلنا لك بريداً بالتفاصيل.
                    </p>
                  </>
                ) : outcome === "provisional" || outcome === "verified" ? (
                  <>
                    <ShieldCheck className="mx-auto h-11 w-11 text-emerald-600" />
                    <h3 className="text-lg font-bold">تم تفعيل حسابك</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      أسعار الجملة مفتوحة لك. راجع بريدك للتفاصيل.
                    </p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mx-auto h-11 w-11 text-blue-600" />
                    <h3 className="text-lg font-bold">استلمنا طلبك</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      حسابك مفتوح وتقدر تتصفح الآن. نراجع الطلب ونخبرك بالبريد.
                    </p>
                  </>
                )}
                <Button asChild className="w-full"><Link href={`/${locale}/shop`}>تصفّح المنتجات</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          بياناتك وصور محلك تُستخدم للتحقق فقط ولا تُنشر.
        </p>
      </div>
    </div>
  );
}
