"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  CircleOff,
  Clock3,
  Grid2X2,
  History,
  List,
  Loader2,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShoppingBasket,
  Trash2,
  TriangleAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import { BatteryFinder, type FinderReplenishmentProduct } from "./battery-finder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductImageSmall } from "@/components/products";
import { getProductImageOrPlaceholderUrl } from "@/lib/odoo/client";
import {
  catalogueStatuses,
  normalizeCatalogue,
  normalizeReplenishmentHistory,
  type CatalogueProduct,
  type CatalogueStatus,
  type ReplenishmentHistoryItem,
} from "@/lib/consignments/catalogue";
import {
  addReplenishmentLine,
  beginReplenishmentSubmission,
  createReplenishmentCart,
  parseReplenishmentCart,
  readReplenishmentAcknowledgements,
  removeReplenishmentLine,
  replenishmentStorageKey,
  replenishmentSubmissionHash,
  replenishmentSubmissionPayload,
  setReplenishmentNote,
  setReplenishmentQuantity,
  unlockAfterConfirmedFailure,
  type ReplenishmentAcknowledgement,
  type ReplenishmentCartState,
} from "@/lib/consignments/replenishment-cart";

interface Props {
  partnerId: string;
  initialCatalogue: unknown;
  initialReplenishments: unknown;
}

type ViewMode = "grid" | "list";
type StatusFilter = "all" | CatalogueStatus;

const statusClass: Record<CatalogueStatus, string> = {
  central: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  unavailable: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  custody: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300",
  pending: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  likely: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};

function statusIcon(status: CatalogueStatus) {
  if (status === "central") return Warehouse;
  if (status === "unavailable") return CircleOff;
  if (status === "custody") return PackageCheck;
  if (status === "pending") return Truck;
  return TriangleAlert;
}

export function ReplenishmentCatalogue({
  partnerId,
  initialCatalogue,
  initialReplenishments,
}: Props) {
  const locale = useLocale();
  const ar = locale === "ar";
  const copy = ar ? {
    finderAdded: "أُضيفت البطارية إلى سلة تعزيز العهدة",
    notAvailable: "هذا المنتج غير متاح للتعزيز حالياً",
    title: "مخزن العهدة",
    subtitle: "كل منتجات العهدة في مكان واحد — ابحث، طابق، وأضف المطلوب لزيارة المندوب القادمة",
    search: "ابحث باسم المنتج أو الرمز أو رقم البطارية",
    grid: "شبكي",
    list: "قائمة",
    all: "الكل",
    central: "متوفر مركزياً",
    unavailable: "نافد",
    custody: "في عهدتك",
    pending: "مطلوب / بالطريق",
    likely: "توافق محتمل",
    centralQty: "متوفر بالمخزن",
    custodyQty: "في عهدتك",
    pendingQty: "قيد الطلب",
    transitQty: "بالطريق",
    add: "أضف للتعزيز",
    blocked: "غير متاح للتعزيز",
    noProducts: "لا توجد منتجات تطابق البحث أو الفلتر",
    basket: "سلة تعزيز العهدة",
    basketHint: "هذه السلة مستقلة تماماً عن سلة الطلبات الاعتيادية",
    emptyBasket: "لم تضف أي منتج بعد",
    note: "ملاحظة للمندوب أو الإدارة",
    notePlaceholder: "مثلاً: الأولوية لبطاريات Dell في الزيارة القادمة",
    clear: "تفريغ",
    undo: "تراجع",
    send: "إرسال طلب التعزيز",
    retry: "إعادة إرسال نفس الطلب",
    sending: "جاري الإرسال",
    locked: "تم تثبيت محتوى الطلب لحمايته من التكرار. يمكنك إعادة إرسال نفس الطلب أو التحقق من حالته.",
    checkStatus: "تحقق من الحالة",
    stillChecking: "لم يظهر تأكيد بعد؛ بقيت السلة مثبتة بنفس رقم الحماية",
    timeout: "انتهت مهلة الاتصال. لم نفرّغ السلة ويمكنك إعادة الإرسال بأمان.",
    rejected: "لم يُقبل الطلب. تم فتح السلة برقم حماية جديد لتصحيحها.",
    invalidAck: "لم يصل تأكيد موثوق من الخادم؛ بقيت السلة مثبتة.",
    sent: "تم تسجيل طلب التعزيز",
    history: "سجل طلبات التعزيز",
    noHistory: "لا توجد طلبات تعزيز سابقة",
    pieces: "قطعة",
    profileDisabled: "ملف التعزيز غير مفعّل لهذا المنتج",
  } : {
    finderAdded: "Battery added to the consignment replenishment basket",
    notAvailable: "This product is not currently available for replenishment",
    title: "Consignment Store",
    subtitle: "All eligible consignment products in one place — search, match and prepare the next rep visit",
    search: "Search product, code or battery part number",
    grid: "Grid",
    list: "List",
    all: "All",
    central: "Central stock",
    unavailable: "Unavailable",
    custody: "In your custody",
    pending: "Pending / in transit",
    likely: "Likely match",
    centralQty: "Central stock",
    custodyQty: "In custody",
    pendingQty: "Pending",
    transitQty: "In transit",
    add: "Add to replenishment",
    blocked: "Not available",
    noProducts: "No products match the search or filter",
    basket: "Consignment replenishment basket",
    basketHint: "This basket is completely separate from the regular order cart",
    emptyBasket: "No products added yet",
    note: "Note for your rep or management",
    notePlaceholder: "Example: prioritize Dell batteries on the next visit",
    clear: "Clear",
    undo: "Undo",
    send: "Send replenishment request",
    retry: "Retry the same request",
    sending: "Sending",
    locked: "The submitted payload is locked against duplicates. Retry it unchanged or check its status.",
    checkStatus: "Check status",
    stillChecking: "No acknowledgement yet; the basket remains locked with the same protection key.",
    timeout: "The request timed out. The basket was kept and can be retried safely.",
    rejected: "The request was rejected. The basket was unlocked with a new protection key.",
    invalidAck: "No trustworthy acknowledgement was returned; the basket remains locked.",
    sent: "Replenishment request recorded",
    history: "Replenishment history",
    noHistory: "No previous replenishment requests",
    pieces: "units",
    profileDisabled: "Replenishment is not enabled for this product",
  };

  const products = useMemo(
    () => normalizeCatalogue(initialCatalogue).filter((product) => product.replenishment_eligible),
    [initialCatalogue],
  );
  const [historyItems, setHistoryItems] = useState<ReplenishmentHistoryItem[]>(
    () => normalizeReplenishmentHistory(initialReplenishments),
  );
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<ReplenishmentCartState>(() => createReplenishmentCart());
  const [undoCart, setUndoCart] = useState<ReplenishmentCartState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAcknowledgements, setLastAcknowledgements] = useState<ReplenishmentAcknowledgement[]>([]);
  const storageKey = replenishmentStorageKey(partnerId);

  useEffect(() => {
    const saved = parseReplenishmentCart(window.localStorage.getItem(storageKey));
    setCart(saved || createReplenishmentCart());
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, hydrated, storageKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return products.filter((product) => {
      if (filter !== "all" && !catalogueStatuses(product).includes(filter)) return false;
      if (!needle) return true;
      return [
        product.name,
        product.code || "",
        product.pns.join(" "),
        product.compatible_devices.join(" "),
      ].join(" ").toLocaleLowerCase().includes(needle);
    });
  }, [filter, products, query]);

  const cartQty = cart.lines.reduce((sum, line) => sum + line.qty, 0);

  const flash = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage((current) => current === value ? null : current), 4200);
  };

  const addProduct = (source: CatalogueProduct | FinderReplenishmentProduct) => {
    const catalogueProduct = products.find((product) => product.product_id === source.product_id);
    if (!catalogueProduct?.can_replenish) {
      flash(copy.notAvailable);
      return;
    }
    const next = addReplenishmentLine(cart, {
      product_id: catalogueProduct.product_id,
      name: catalogueProduct.name,
      code: catalogueProduct.code,
      confidence: source.confidence || catalogueProduct.confidence,
    });
    if (next === cart) return;
    setCart(next);
    setUndoCart(null);
    setBasketOpen(true);
    flash(copy.finderAdded);
  };

  const changeQty = (productId: number, qty: number) => {
    setCart((current) => setReplenishmentQuantity(current, productId, qty));
  };

  const removeLine = (productId: number) => {
    if (cart.submissionPending) return;
    setUndoCart(cart);
    setCart(removeReplenishmentLine(cart, productId));
  };

  const clearCart = () => {
    if (cart.submissionPending || !cart.lines.length) return;
    setUndoCart(cart);
    setCart(createReplenishmentCart());
  };

  const undo = () => {
    if (!undoCart) return;
    setCart(undoCart);
    setUndoCart(null);
  };

  const fetchHistory = async (): Promise<ReplenishmentHistoryItem[] | null> => {
    try {
      const response = await fetch("/api/client/consignments/replenishments", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      if (!response.ok) return null;
      const next = normalizeReplenishmentHistory(await response.json());
      setHistoryItems(next);
      return next;
    } catch {
      return null;
    }
  };

  const completeAcknowledgedRequest = (
    acknowledgements: ReplenishmentAcknowledgement[],
  ) => {
    setLastAcknowledgements(acknowledgements);
    setCart(createReplenishmentCart());
    setUndoCart(null);
    flash(copy.sent + ": " + acknowledgements.map((item) => item.name).join("، "));
    void fetchHistory();
  };

  const submit = async () => {
    if (!cart.lines.length || submitting) return;

    const hash = await replenishmentSubmissionHash(cart);
    if (cart.submissionPending && cart.submissionHash && cart.submissionHash !== hash) {
      flash(copy.invalidAck);
      return;
    }

    const locked = cart.submissionPending
      ? cart
      : beginReplenishmentSubmission(cart, hash);
    setCart(locked);
    window.localStorage.setItem(storageKey, JSON.stringify(locked));
    setSubmitting(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/client/consignments/replenishments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Idempotency-Key": locked.idempotencyKey,
        },
        body: JSON.stringify(replenishmentSubmissionPayload(locked)),
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      const acknowledgements = readReplenishmentAcknowledgements(payload);

      if (response.ok && acknowledgements) {
        completeAcknowledgedRequest(acknowledgements);
        return;
      }

      const definitelyRejected = response.status >= 400 &&
        response.status < 500 &&
        ![408, 409, 425, 429].includes(response.status);
      if (definitelyRejected) {
        setCart(unlockAfterConfirmedFailure(locked));
        flash(response.status === 401 ? copy.rejected : copy.rejected);
      } else {
        flash(response.ok ? copy.invalidAck : copy.timeout);
      }
    } catch {
      flash(copy.timeout);
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  const resolvePending = async () => {
    if (!cart.submissionPending || checking) return;
    setChecking(true);
    const latest = await fetchHistory();
    const matches = latest?.filter((item) => item.group_key === cart.idempotencyKey) || [];
    if (matches.length) {
      completeAcknowledgedRequest(matches.map((item) => ({
        id: item.id,
        name: item.name,
        state: item.state,
      })));
    } else {
      flash(copy.stillChecking);
    }
    setChecking(false);
  };

  const statusLabel = (status: CatalogueStatus) => copy[status];
  const stateLabel = (state: string) => {
    const values: Record<string, string> = ar ? {
      requested: "مطلوب",
      pending: "قيد المراجعة",
      approved: "موافق عليه",
      in_transit: "بالطريق",
      delivered: "تم التسليم",
      rejected: "مرفوض",
      cancelled: "ملغي",
    } : {
      requested: "Requested",
      pending: "Pending",
      approved: "Approved",
      in_transit: "In transit",
      delivered: "Delivered",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };
    return values[state] || state;
  };

  return (
    <div className="space-y-4">
      <BatteryFinder onAddToReplenishment={addProduct} />

      <Card className="overflow-hidden border-violet-200 shadow-sm dark:border-violet-800/60">
        <div className="bg-gradient-to-l from-slate-950 via-violet-950 to-violet-800 p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-violet-200" />
                <h2 className="text-lg font-extrabold">{copy.title}</h2>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-violet-100">{copy.subtitle}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setBasketOpen((open) => !open)}
              className="relative shrink-0 bg-white text-violet-950 hover:bg-violet-50"
            >
              <ShoppingBasket className="me-1 h-4 w-4" />
              {cartQty.toLocaleString("en-US")}
              {cart.submissionPending && (
                <span className="absolute -end-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-400 ring-2 ring-violet-950" />
              )}
            </Button>
          </div>
        </div>

        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.search}
                className="h-10 w-full rounded-xl border bg-background ps-9 pe-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
            <div className="flex rounded-xl border bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant={view === "grid" ? "default" : "ghost"}
                onClick={() => setView("grid")}
                className="h-8 flex-1 sm:flex-none"
              >
                <Grid2X2 className="me-1 h-3.5 w-3.5" /> {copy.grid}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "list" ? "default" : "ghost"}
                onClick={() => setView("list")}
                className="h-8 flex-1 sm:flex-none"
              >
                <List className="me-1 h-3.5 w-3.5" /> {copy.list}
              </Button>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["all", "central", "unavailable", "custody", "pending", "likely"] as StatusFilter[]).map((value) => (
              <button
                type="button"
                key={value}
                onClick={() => setFilter(value)}
                className={"whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors " +
                  (filter === value
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "bg-background text-muted-foreground hover:border-violet-300")}
              >
                {value === "all" ? copy.all : statusLabel(value)}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              {copy.noProducts}
            </div>
          ) : (
            <div className={view === "grid"
              ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              : "space-y-2"}>
              {filtered.map((product) => {
                const statuses = catalogueStatuses(product);
                const inCart = cart.lines.find((line) => line.product_id === product.product_id);
                return (
                  <div
                    key={product.product_id}
                    className={"rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md " +
                      (view === "list" ? "sm:flex sm:items-center sm:gap-3" : "")}
                  >
                    <div className={"flex gap-3 " + (view === "list" ? "sm:flex-1" : "")}>
                      <ProductImageSmall
                        src={getProductImageOrPlaceholderUrl(
                          product.product_id,
                          "256x256",
                          product.image_version || undefined,
                        )}
                        alt={product.name}
                        className="h-16 w-16 shrink-0 rounded-xl bg-muted"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-bold leading-snug" dir="ltr">{product.name}</p>
                        {product.code && (
                          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" dir="ltr">
                            {product.code}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {statuses.map((status) => {
                            const Icon = statusIcon(status);
                            const qty = status === "central"
                              ? product.central_qty
                              : status === "custody"
                                ? product.custody_qty
                                : status === "pending"
                                  ? product.pending_qty + product.in_transit_qty
                                  : null;
                            return (
                              <span
                                key={status}
                                className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold " + statusClass[status]}
                              >
                                <Icon className="h-3 w-3" />
                                {statusLabel(status)}
                                {qty !== null && " · " + qty.toLocaleString("en-US")}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={"mt-3 grid grid-cols-4 gap-1 text-center " +
                      (view === "list" ? "sm:mt-0 sm:w-[330px]" : "")}>
                      {[
                        [copy.centralQty, product.central_qty],
                        [copy.custodyQty, product.custody_qty],
                        [copy.pendingQty, product.pending_qty],
                        [copy.transitQty, product.in_transit_qty],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-lg bg-muted/60 px-1 py-1.5">
                          <p className="truncate text-[8.5px] text-muted-foreground">{label}</p>
                          <p className="text-xs font-extrabold tabular-nums">{Number(value).toLocaleString("en-US")}</p>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      disabled={!product.can_replenish || cart.submissionPending}
                      onClick={() => addProduct(product)}
                      className={"mt-3 w-full " +
                        (view === "list" ? "sm:mt-0 sm:w-44" : "") +
                        (product.can_replenish ? " bg-violet-600 text-white hover:bg-violet-700" : "")}
                      variant={product.can_replenish ? "default" : "secondary"}
                      title={product.can_replenish ? copy.add : copy.profileDisabled}
                    >
                      {product.can_replenish ? <Plus className="me-1 h-4 w-4" /> : <CircleOff className="me-1 h-4 w-4" />}
                      {inCart ? inCart.qty.toLocaleString("en-US") + " · " + copy.add : product.can_replenish ? copy.add : copy.blocked}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {basketOpen && (
        <Card className="border-violet-300 shadow-lg dark:border-violet-700">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold">
                  <ShoppingBasket className="h-4 w-4 text-violet-600" /> {copy.basket}
                </h3>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">{copy.basketHint}</p>
              </div>
              <Badge variant="secondary">{cartQty.toLocaleString("en-US")} {copy.pieces}</Badge>
            </div>

            {cart.submissionPending && (
              <div className="flex items-start gap-2 rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{copy.locked}</span>
              </div>
            )}

            {!cart.lines.length ? (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                {copy.emptyBasket}
              </div>
            ) : (
              <div className="space-y-2">
                {cart.lines.map((line) => (
                  <div key={line.product_id} className="flex items-center gap-2 rounded-xl border p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold" dir="ltr">{line.name}</p>
                      {line.code && <p className="font-mono text-[9.5px] text-muted-foreground" dir="ltr">{line.code}</p>}
                      {line.confidence === "likely" && (
                        <p className="mt-1 flex items-center gap-1 text-[9.5px] font-semibold text-amber-700 dark:text-amber-400">
                          <TriangleAlert className="h-3 w-3" /> {copy.likely}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center rounded-lg border">
                      <button
                        type="button"
                        disabled={cart.submissionPending}
                        onClick={() => changeQty(line.product_id, line.qty - 1)}
                        className="p-2 disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        disabled={cart.submissionPending}
                        value={line.qty}
                        onChange={(event) => changeQty(line.product_id, Number(event.target.value))}
                        className="w-12 border-x bg-transparent py-1 text-center text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        disabled={cart.submissionPending}
                        onClick={() => changeQty(line.product_id, line.qty + 1)}
                        className="p-2 disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={cart.submissionPending}
                      onClick={() => removeLine(line.product_id)}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-bold">{copy.note}</span>
              <textarea
                value={cart.note}
                disabled={cart.submissionPending}
                onChange={(event) => setCart((current) => setReplenishmentNote(current, event.target.value))}
                placeholder={copy.notePlaceholder}
                rows={3}
                className="w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!cart.lines.length || cart.submissionPending}
                onClick={clearCart}
              >
                <Trash2 className="me-1 h-3.5 w-3.5" /> {copy.clear}
              </Button>
              {undoCart && !cart.submissionPending && (
                <Button type="button" variant="outline" size="sm" onClick={undo}>
                  <RotateCcw className="me-1 h-3.5 w-3.5" /> {copy.undo}
                </Button>
              )}
              {cart.submissionPending && (
                <Button type="button" variant="outline" size="sm" disabled={checking} onClick={() => void resolvePending()}>
                  {checking ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <Clock3 className="me-1 h-3.5 w-3.5" />}
                  {copy.checkStatus}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!cart.lines.length || submitting}
                onClick={() => void submit()}
                className="ms-auto bg-violet-600 text-white hover:bg-violet-700"
              >
                {submitting ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" /> : <Send className="me-1 h-3.5 w-3.5" />}
                {submitting ? copy.sending : cart.submissionPending ? copy.retry : copy.send}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lastAcknowledgements.length > 0 && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-4 w-4" /> {copy.sent}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {lastAcknowledgements.map((item) => (
              <Badge key={item.id} variant="outline">{item.name} · {stateLabel(item.state)}</Badge>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <History className="h-4 w-4 text-violet-600" /> {copy.history}
          </h3>
          {historyItems.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{copy.noHistory}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {historyItems.slice(0, 12).map((item) => (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold" dir="ltr">{item.name}</p>
                      {item.created_at && (
                        <p className="mt-0.5 text-[9.5px] text-muted-foreground" dir="ltr">
                          {new Date(item.created_at).toLocaleString(locale)}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">{stateLabel(item.state)}</Badge>
                  </div>
                  {item.lines.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.lines.map((line, index) => (
                        <span key={line.product_id + "-" + index} className="rounded-full bg-muted px-2 py-1 text-[9.5px]">
                          <span dir="ltr">{line.name}</span> · {line.qty.toLocaleString("en-US")}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.note && <p className="mt-2 text-[10.5px] text-muted-foreground">{item.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {message && (
        <div className="fixed bottom-5 inset-x-0 z-[80] flex justify-center px-4 pointer-events-none">
          <div className="max-w-[92vw] rounded-xl bg-foreground px-4 py-2.5 text-xs font-bold text-background shadow-xl">
            {message}
          </div>
        </div>
      )}
    </div>
  );
}
