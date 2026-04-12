/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Invoice } from "@/types";

interface InvoicePrintViewProps {
  invoice: Invoice;
}

function formatMoney(amount: number, currency?: string): string {
  if (currency === "USD") {
    return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Math.round(amount).toLocaleString("en-US");
}

export default function InvoicePrintView({ invoice }: InvoicePrintViewProps) {
  const [generatingPdf, setGeneratingPdf] = useState("");

  const cur = invoice.currency_code || "IQD";
  const curSymbol = cur === "USD" ? "$" : "د.ع";
  const isUnpaid = invoice.balance > 0;
  const amountPaid = invoice.total - invoice.balance;
  const isRefund = false; // Client app only shows out_invoice

  let totalQty = 0;
  (invoice.line_items || []).forEach((line) => { totalQty += line.quantity; });

  const qrUrl = `https://rep.tsh.sale/verify/invoice/${(invoice.invoice_number || "").replace(/\//g, "-")}`;

  const generatePdf = async (): Promise<Blob | null> => {
    const el = document.querySelector(".invoice-page") as HTMLElement;
    if (!el) return null;
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const w = imgW * ratio;
      const h = imgH * ratio;
      pdf.addImage(imgData, "JPEG", (pdfW - w) / 2, 0, w, h);
      return pdf.output("blob");
    } catch (e: any) {
      console.error("PDF generation failed:", e);
      return null;
    }
  };

  const handleSharePdf = async (via: "share" | "whatsapp") => {
    setGeneratingPdf(via);
    try {
      const blob = await generatePdf();
      if (!blob) { alert("فشل إنشاء PDF"); return; }

      const fileName = (invoice.invoice_number || "invoice").replace(/\//g, "-") + ".pdf";
      const file = new File([blob], fileName, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: invoice.invoice_number || "فاتورة",
          text: (invoice.invoice_number || "فاتورة") + " - " + (invoice.customer_name || ""),
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Share error:", e);
        const blob = await generatePdf();
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = (invoice.invoice_number || "invoice").replace(/\//g, "-") + ".pdf";
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } finally {
      setGeneratingPdf("");
    }
  };

  const lines = invoice.line_items || [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
        * { box-sizing: border-box; }
        body { 
          margin: 0; padding: 0; background: #e2e8f0; 
          font-family: 'IBM Plex Sans Arabic', 'Cairo', 'Inter', sans-serif; 
          color: #1a1a2e;
          -webkit-font-smoothing: antialiased;
        }
        
        nav, [class*="BottomNav"], [class*="DesktopSidebar"], header, footer { display: none !important; }
        
        @media screen and (max-width: 800px) {
          .invoice-page { width: 100% !important; max-width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; min-height: auto !important; }
          .invoice-page > div { padding: 12px 10px !important; }
        }
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; }
          @page { size: A4 portrait; margin: 10mm; }
        }

        .invoice-page {
          width: 210mm;
          max-width: 100%;
          min-height: auto;
          margin: 0 auto;
          background: #FFFFFF;
          padding: 0;
          box-shadow: 0 2px 24px rgba(0,0,0,0.08);
          position: relative;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .en { font-family: 'Inter', sans-serif; }
        .mono { font-family: 'Inter', monospace; font-feature-settings: "tnum"; direction: ltr; display: inline-block; }
      `}</style>

      {/* A4 Document */}
      <div className="invoice-page" dir="rtl">
        
        {/* Brand Bar */}
        <div style={{ height: "6px", background: "linear-gradient(90deg, #1e40af, #3b82f6, #06b6d4)" }} />
        
        {/* Content wrapper */}
        <div style={{ padding: "20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              height: "48px", width: "48px", display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg, #0f2557 0%, #1e40af 40%, #2563eb 100%)",
              borderRadius: "10px", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(30,64,175,0.3)",
            }}>
              <span className="en" style={{ fontSize: "16pt", fontWeight: 900, color: "#fff", letterSpacing: "1.5px", lineHeight: 1 }}>TSH</span>
            </div>
            <div>
              <h2 style={{ fontSize: "9.5pt", fontWeight: 800, color: "#1e293b", margin: 0, lineHeight: 1.4 }}>
                شركة يد العنكبوت التقنية للتجارة العامة م.م
              </h2>
              <div className="en" style={{ fontSize: "6.5pt", fontWeight: 600, color: "#64748b", letterSpacing: "0.3px" }}>
                TECH SPIDER HAND FOR GENERAL TRADING LTD
              </div>
            </div>
          </div>
          <div style={{ textAlign: "left" }}>
            <h1 style={{ fontSize: "22pt", fontWeight: 900, color: "#1e293b", margin: 0, letterSpacing: "-0.5px" }}>فاتورة</h1>
            <div className="en" style={{ fontSize: "9pt", fontWeight: 600, color: "#94a3b8", letterSpacing: "3px", textAlign: "left" }}>INVOICE</div>
          </div>
        </div>

        {/* Contact + QR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", paddingBottom: "14px", borderBottom: "2px solid #1e40af" }}>
          <div style={{ fontSize: "7.5pt", color: "#64748b", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span className="mono" style={{ direction: "ltr" }}>+964 771 388 4329</span>
            <span style={{ color: "#cbd5e1" }}>|</span>
            <span>بغداد، العراق</span>
            <span style={{ color: "#cbd5e1" }}>|</span>
            <span className="en" style={{ fontWeight: 600 }}>tsh.sale</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ fontSize: "6.5pt", color: "#94a3b8", lineHeight: 1.3, textAlign: "left" }}>
              <div>تحقق</div>
              <div className="en">Verify</div>
            </div>
            <div style={{ width: "40px", height: "40px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "5px", padding: "2px" }}>
              <QRCode value={qrUrl} size={36} style={{ width: "100%", height: "100%" }} />
            </div>
          </div>
        </div>

        {/* ═══ META + CUSTOMER ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
          
          {/* Invoice Meta */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "14px", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", fontSize: "9pt", borderSpacing: "0 6px", borderCollapse: "separate" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 500, width: "42%" }}>رقم الفاتورة</td>
                  <td className="mono" style={{ fontWeight: 700, fontSize: "11pt", color: "#1e293b" }}>{invoice.invoice_number}</td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 500 }}>التاريخ</td>
                  <td className="mono" style={{ color: "#1e293b" }}>{invoice.date}</td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 500 }}>الاستحقاق</td>
                  <td className="mono" style={{ color: "#1e293b" }}>{invoice.due_date}</td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 500 }}>العملة</td>
                  <td className="mono">{cur}</td>
                </tr>
                <tr>
                  <td style={{ color: "#64748b", fontWeight: 500 }}>الحالة</td>
                  <td>
                    <span style={{
                      display: "inline-block", padding: "2px 10px", fontSize: "8pt", fontWeight: 700,
                      borderRadius: "4px", letterSpacing: "0.5px",
                      background: isUnpaid ? "#fef2f2" : "#f0fdf4",
                      color: isUnpaid ? "#dc2626" : "#16a34a",
                      border: `1px solid ${isUnpaid ? "#fecaca" : "#bbf7d0"}`,
                    }}>
                      {isUnpaid ? "غير مدفوعة" : "مدفوعة"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Customer Info */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "14px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "8pt", color: "#94a3b8", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              فاتورة إلى
            </div>
            <div style={{ fontSize: "11pt", fontWeight: 700, color: "#1e293b", marginBottom: "8px", lineHeight: 1.4 }}>
              {(invoice.customer_name || "").replace(/^[.\s-]+|[.\s-]+$/g, "")}
            </div>
            <div style={{ fontSize: "8.5pt", color: "#64748b", lineHeight: 1.8 }}>
              <div style={{ color: "#94a3b8" }}>العراق</div>
            </div>
          </div>
        </div>

        {/* ═══ ITEMS TABLE ═══ */}
        {lines.length > 0 && (
          <>
            <div style={{ fontSize: "8pt", color: "#94a3b8", marginBottom: "6px", display: "flex", gap: "12px", fontWeight: 500 }}>
              <span>{lines.length} منتج</span>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <span>{totalQty.toLocaleString("en-US")} قطعة</span>
            </div>

            <table dir="ltr" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", marginBottom: "18px", border: "1px solid #e2e8f0" }}>
              <colgroup>
                <col style={{ width: "5%" }} />
                <col style={{ width: "55%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  {["#", "Description / الوصف", "Qty", "Price", "Total"].map((h, i) => (
                    <th key={h} style={{
                      background: "#f0f4f8", padding: "8px 6px", fontSize: "8pt", fontWeight: 600,
                      color: "#64748b", borderBottom: "2px solid #94a3b8",
                      textAlign: i === 0 || i === 2 ? "center" : i >= 3 ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={line.line_item_id || i} style={{ background: i % 2 === 1 ? "#fafbfc" : "#fff" }}>
                    <td style={{ padding: "7px 6px", fontSize: "8.5pt", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", textAlign: "center", verticalAlign: "middle" }}>{i + 1}</td>
                    <td style={{ padding: "7px 6px", fontSize: "8.5pt", color: "#1e293b", fontWeight: 500, borderBottom: "1px solid #e2e8f0", textAlign: "left", verticalAlign: "middle", lineHeight: 1.3, wordBreak: "break-word" }}>
                      {line.name || line.item_name || line.description || `Item #${i + 1}`}
                    </td>
                    <td style={{ padding: "7px 6px", fontSize: "9pt", color: "#1e293b", borderBottom: "1px solid #e2e8f0", textAlign: "center", verticalAlign: "middle", fontFamily: "Inter, monospace" }}>{line.quantity.toLocaleString("en-US")}</td>
                    <td style={{ padding: "7px 6px", fontSize: "9pt", color: "#1e293b", borderBottom: "1px solid #e2e8f0", textAlign: "right", verticalAlign: "middle", fontFamily: "Inter, monospace" }}>{formatMoney(line.rate, cur)}</td>
                    <td style={{ padding: "7px 6px", fontSize: "9pt", color: "#1e293b", fontWeight: 600, borderBottom: "1px solid #e2e8f0", textAlign: "right", verticalAlign: "middle", fontFamily: "Inter, monospace" }}>{formatMoney(line.item_total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ═══ TOTALS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px" }}>
          
          {/* Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "8pt", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>ملاحظات</div>
              {invoice.notes ? (
                <div style={{ fontSize: "8.5pt", color: "#64748b", lineHeight: 1.5 }}>
                  {invoice.notes.replace(/<[^>]*>/g, "")}
                </div>
              ) : (
                <p style={{ fontSize: "8.5pt", color: "#94a3b8", margin: 0 }}>
                  تُقبل المرتجعات خلال 7 أيام من تاريخ الشراء.
                </p>
              )}
            </div>
          </div>

          {/* Totals Table */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 500 }}>المجموع</td>
                  <td className="mono" style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>{formatMoney(invoice.sub_total || invoice.total, cur)}</td>
                </tr>
                {(invoice.tax_total || 0) > 0 && (
                <tr>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 500 }}>الضريبة</td>
                  <td className="mono" style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>{formatMoney(invoice.tax_total, cur)}</td>
                </tr>
                )}
                <tr style={{ background: "#1e293b" }}>
                  <td style={{ padding: "12px 14px", color: "#fff", fontWeight: 700, fontSize: "10pt" }}>الإجمالي</td>
                  <td className="mono" style={{ padding: "12px 14px", textAlign: "left", fontSize: "16pt", fontWeight: 800, color: "#fff" }}>
                    {formatMoney(invoice.total, cur)} <span style={{ fontSize: "9pt", fontWeight: 500, opacity: 0.7 }}>{curSymbol}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 500 }}>المدفوع</td>
                  <td className="mono" style={{ padding: "9px 14px", borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#16a34a" }}>{formatMoney(amountPaid, cur)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "#1e293b", fontSize: "10pt" }}>المتبقي</td>
                  <td className="mono" style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, fontSize: "13pt", color: isUnpaid ? "#dc2626" : "#1e293b" }}>
                    {formatMoney(invoice.balance, cur)} <span style={{ fontSize: "8pt", fontWeight: 500, color: "#94a3b8" }}>{curSymbol}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ STAMPS ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
          <div style={{ borderTop: "2px dashed #cbd5e1", paddingTop: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "8pt", color: "#94a3b8", marginBottom: "40px" }}>ختم وتوقيع البائع</div>
          </div>
          <div style={{ borderTop: "2px dashed #cbd5e1", paddingTop: "10px", textAlign: "center" }}>
            <div style={{ fontSize: "8pt", color: "#94a3b8", marginBottom: "40px" }}>ختم وتوقيع المشتري</div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{ marginTop: "auto", paddingTop: "10px", borderTop: "2px solid #1e40af" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "9pt", color: "#1e293b", fontWeight: 700, marginBottom: "2px" }}>شكراً لتعاملكم معنا</div>
              <div style={{ fontSize: "7pt", color: "#94a3b8", lineHeight: 1.5 }}>شركة يد العنكبوت التقنية — بغداد، العراق</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div className="en" style={{ fontSize: "7.5pt", color: "#64748b", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600 }}>tsh.sale</span>
                <span style={{ margin: "0 4px", color: "#cbd5e1" }}>|</span>
                +964 771 388 4329
              </div>
              <div className="en" style={{ fontSize: "6.5pt", color: "#cbd5e1", marginTop: "1px" }}>
                TECH SPIDER HAND FOR GENERAL TRADING LTD
              </div>
            </div>
          </div>
        </div>

        </div>{/* end content wrapper */}
      </div>

      {/* Action Buttons */}
      <div className="no-print" dir="rtl" style={{
        width: "210mm", maxWidth: "100%", margin: "0 auto",
        padding: "16px 12px 40px",
        display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap",
      }}>
        <button onClick={() => window.print()} style={{ flex: "1 1 0", minWidth: "75px", maxWidth: "130px", padding: "14px 6px", background: "#3b82f6", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}>
          🖨️ طباعة
        </button>
        <button 
          onClick={() => handleSharePdf("share")}
          disabled={!!generatingPdf}
          style={{ flex: "1 1 0", minWidth: "75px", maxWidth: "130px", padding: "14px 6px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(139,92,246,0.3)", opacity: generatingPdf ? 0.6 : 1 }}>
          {generatingPdf === "share" ? "جارٍ..." : "📤 مشاركة"}
        </button>
        <button 
          onClick={() => handleSharePdf("whatsapp")}
          disabled={!!generatingPdf}
          style={{ flex: "1 1 0", minWidth: "75px", maxWidth: "130px", padding: "14px 6px", background: "#22c55e", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(34,197,94,0.3)", opacity: generatingPdf ? 0.6 : 1 }}>
          {generatingPdf === "whatsapp" ? "جارٍ..." : "💬 واتساب"}
        </button>
        <button onClick={() => window.history.back()} style={{ flex: "1 1 0", minWidth: "75px", maxWidth: "130px", padding: "14px 6px", background: "#475569", color: "white", border: "none", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontSize: "13px", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(71,85,105,0.3)" }}>
          ← رجوع
        </button>
      </div>
    </>
  );
}
