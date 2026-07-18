// ============================================
// Company contact points (storefront)
// ============================================
// Sales WhatsApp = company phone from Odoo res.company (id=1), digits only.
// Change here (or move to env) if the sales line ever changes.
// ============================================

export const WHATSAPP_SALES_NUMBER = "9647713884329"; // +964 771 388 4329

export const COMPANY_PHONE_DISPLAY = "+964 771 388 4329";

export function whatsappSalesLink(message?: string): string {
  const base = `https://wa.me/${WHATSAPP_SALES_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
