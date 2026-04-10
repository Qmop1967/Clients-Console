"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  Plus,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Camera,
  ImageIcon,
  Loader2,
  ChevronRight,
  Send,
  RotateCcw,
  Wrench,
  XCircle,
} from "lucide-react";

// --- Types ---
interface OrderProduct {
  id: number;
  product_id: number;
  product_name: string;
  qty: number;
  price: number;
}
interface Order {
  id: number;
  name: string;
  date: string;
  amount: number;
  products: OrderProduct[];
}
interface Ticket {
  id: number;
  name: string;
  type_label: string;
  state: string;
  state_label: string;
  description: string;
  created_at: string;
  item_location_label: string | null;
}

// --- Constants ---
const TYPES = [
  { value: "damage", label: "تلف / عطل", icon: AlertTriangle, desc: "المنتج تالف أو لا يعمل" },
  { value: "return", label: "مرتجع", icon: RotateCcw, desc: "إرجاع المنتج" },
  { value: "exchange", label: "استبدال", icon: Package, desc: "استبدال بمنتج آخر" },
  { value: "general", label: "مشكلة أخرى", icon: Wrench, desc: "مشكلة عامة" },
];

const STATE_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  new: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", icon: Clock },
  under_review: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", icon: Clock },
  awaiting_approval: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", icon: Clock },
  in_progress: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", icon: Wrench },
  resolved: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", icon: CheckCircle2 },
  closed: { bg: "bg-gray-50 dark:bg-gray-950/30", text: "text-gray-500", icon: CheckCircle2 },
  rejected: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", icon: XCircle },
};

export default function SupportPage() {
  // Views: list | new
  const [view, setView] = useState<"list" | "new">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // New ticket state
  const [step, setStep] = useState(1); // 1:type, 2:order+product, 3:describe+submit
  const [type, setType] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<OrderProduct | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: number; name: string } | null>(null);

  // Load tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      if (data.success) setTickets(data.data?.tickets || data.data || []);
    } catch {}
    setLoadingTickets(false);
  };

  // Load orders when entering step 2
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/support/orders");
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch {}
    setLoadingOrders(false);
  };

  const startNewTicket = () => {
    setView("new");
    setStep(1);
    setType("");
    setSelectedOrder(null);
    setSelectedProduct(null);
    setDescription("");
    setSubmitted(null);
  };

  const selectType = (t: string) => {
    setType(t);
    setStep(2);
    loadOrders();
  };

  const selectOrderAndProduct = (order: Order, product: OrderProduct) => {
    setSelectedOrder(order);
    setSelectedProduct(product);
    setStep(3);
  };

  const skipOrderSelection = () => {
    setSelectedOrder(null);
    setSelectedProduct(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type,
        description,
        item_location: "customer",
      };
      if (selectedOrder) body.order_id = selectedOrder.id;
      if (selectedProduct) {
        body.products = [{ product_id: selectedProduct.product_id, qty: 1, reason: description }];
      }

      const res = await fetch("/api/support/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(data.data);
      } else {
        alert(data.error || "حدث خطأ");
      }
    } catch {
      alert("خطأ في الاتصال");
    }
    setSubmitting(false);
  };

  const backToList = () => {
    setView("list");
    fetchTickets();
  };

  // ===== SUCCESS VIEW =====
  if (submitted) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Card className="text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold">تم إرسال طلبك بنجاح</h2>
            <p className="text-muted-foreground">
              رقم التتبع: <span className="font-mono font-bold text-foreground">{submitted.name}</span>
            </p>
            <p className="text-sm text-muted-foreground">سيتم التواصل معك من قبل فريقنا في أقرب وقت</p>
            <Button onClick={backToList} className="w-full mt-4">
              العودة لطلباتي
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== NEW TICKET VIEW =====
  if (view === "new") {
    return (
      <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : setView("list")}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">طلب دعم جديد</h1>
            <p className="text-xs text-muted-foreground">خطوة {step} من 3</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
              step >= s ? "bg-primary" : "bg-muted"
            }`} />
          ))}
        </div>

        {/* STEP 1: Type */}
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="font-semibold">ما نوع المشكلة؟</h2>
            {TYPES.map(t => (
              <Card key={t.value} className="cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                onClick={() => selectType(t.value)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <t.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* STEP 2: Select Order + Product */}
        {step === 2 && (
          <div className="space-y-3">
            <h2 className="font-semibold">اختر الطلب والمنتج</h2>
            <p className="text-xs text-muted-foreground">اختر المنتج الذي تواجه مشكلة فيه</p>

            {loadingOrders ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد طلبات سابقة</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Card key={order.id}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-mono">{order.name}</CardTitle>
                        <span className="text-xs text-muted-foreground">{order.date}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1.5">
                      {order.products.map(p => (
                        <button key={p.id} onClick={() => selectOrderAndProduct(order, p)}
                          className="w-full text-right p-3 rounded-lg bg-muted/50 hover:bg-muted flex items-center gap-3 transition-colors">
                          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{p.product_name}</div>
                            <div className="text-[10px] text-muted-foreground">الكمية: {p.qty}</div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 rtl:rotate-180" />
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={skipOrderSelection}>
              تخطي — المشكلة ليست مرتبطة بطلب محدد
            </Button>
          </div>
        )}

        {/* STEP 3: Description + Submit */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold">صف المشكلة</h2>

            {/* Selected product summary */}
            {selectedProduct && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3 flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{selectedProduct.product_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      الطلب {selectedOrder?.name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <label className="text-sm font-medium block mb-1.5">وصف المشكلة *</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="اشرح المشكلة بالتفصيل..."
                className="min-h-[120px] resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !description.trim()}
              className="w-full gap-2"
              size="lg"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...</>
              ) : (
                <><Send className="h-4 w-4" /> إرسال الطلب</>
              )}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ===== TICKETS LIST VIEW =====
  return (
    <div className="container mx-auto px-4 py-6 max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الدعم الفني</h1>
        <Button onClick={startNewTicket} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> طلب جديد
        </Button>
      </div>

      {loadingTickets ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-semibold mb-1">لا توجد طلبات دعم</h3>
            <p className="text-sm text-muted-foreground mb-4">إذا واجهت مشكلة في أي منتج، يمكنك فتح طلب دعم هنا</p>
            <Button onClick={startNewTicket} className="gap-1.5">
              <Plus className="h-4 w-4" /> طلب دعم جديد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => {
            const style = STATE_STYLES[t.state] || STATE_STYLES.new;
            const StateIcon = style.icon;
            return (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono text-sm font-bold">{t.name}</span>
                      <span className="text-xs text-muted-foreground mr-2">{t.type_label}</span>
                    </div>
                    <Badge variant="secondary" className={`${style.bg} ${style.text} text-[10px] gap-1`}>
                      <StateIcon className="h-3 w-3" />
                      {t.state_label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>{new Date(t.created_at).toLocaleDateString("ar-SA")}</span>
                    {t.item_location_label && <span>📍 {t.item_location_label}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
