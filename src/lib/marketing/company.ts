/**
 * Single source of truth for public-facing company facts.
 *
 * WHY THIS FILE EXISTS (2026-07-20):
 * Meta disabled all TSH WhatsApp Business Accounts on Jul 18, 2026 with the reason
 * "the website listed in its Business Manager profile does not have information needed
 * to determine that your business complies with our Business Policy."
 * tsh.sale redirected every visitor to /login, so a reviewer could not see who we are.
 * These pages are the public shop-window. Trading stays behind auth.
 *
 * DATA PROVENANCE: address / phone / email pulled from Odoo res_company + res_partner.
 * Category counts are real active sale_ok product_template counts. Do not invent values.
 * The English legal name MUST stay letter-for-letter identical to the Meta Business
 * Manager name ("Tech Spider Hand Ltd Company") — name mismatch is the #1 rejection cause.
 */

export type MarketingLocale = "ar" | "en";

/** ckb/kmr read Arabic, tm reads English — mirrors localeToOdooLang() in i18n/config. */
export function toMarketingLocale(locale: string): MarketingLocale {
  return locale === "en" || locale === "tm" ? "en" : "ar";
}

export const COMPANY = {
  brand: "TSH",
  legalNameEn: "Tech Spider Hand Ltd Company",
  legalNameAr: "شركة يد العنكبوت التقنية للتجارة العامة محدودة المسؤولية",
  /** Registered short name exactly as recorded on the Meta Business Manager profile. */
  registeredShortName: "T.S.H",
  incorporation: "Iraqi Companies Law No. 21 of 1997",
  incorporationAr: "قانون الشركات العراقي رقم 21 لسنة 1997",
  streetEn: "Dora, Street 19, Block 828, Office No. 3",
  streetAr: "الدورة – شارع 19 – مربع 828 – مكتب رقم 3",
  cityEn: "Baghdad 10023, Iraq",
  cityAr: "بغداد 10023، العراق",
  phone: "+9647713884329",
  phoneDisplay: "+964 771 388 4329",
  email: "info@tsh.sale",
  website: "https://tsh.sale",
  hoursEn: "Sunday – Thursday, 9:00 – 18:00 (Baghdad time)",
  hoursAr: "الأحد – الخميس، 9:00 صباحاً – 6:00 مساءً (بتوقيت بغداد)",
} as const;

/** Live counts from Odoo product_category x product_template (active, sale_ok). */
export const CATEGORIES = [
  { key: "computers", en: "Computers & Components", ar: "الحواسيب والمكوّنات", count: 546,
    enDesc: "Hard drives, external storage, laptop batteries and chargers, keyboards, mice, HD cables, flash drives and accessories.",
    arDesc: "أقراص صلبة ووحدات تخزين خارجية، بطاريات وشواحن لابتوب، كيبوردات، ماوسات، كيبلات HD، فلاشات وملحقات." },
  { key: "cctv", en: "CCTV & Security Systems", ar: "كاميرات المراقبة وأنظمة الأمان", count: 301,
    enDesc: "Standalone and Wi-Fi cameras, complete camera systems, mounts, power supplies and camera cabling.",
    arDesc: "كاميرات مفردة وواي فاي، سستمات كاميرات كاملة، ستاندات، محوّلات وبورسبلاي، وكيبلات كاميرات." },
  { key: "networking", en: "Networking", ar: "منتجات الشبكات", count: 286,
    enDesc: "Routers, network cabling, fiber components and networking accessories.",
    arDesc: "راوترات، كيبلات شبكات، مستلزمات فايبر، وملحقات الشبكات." },
  { key: "power", en: "Power Supplies", ar: "مصادر الطاقة", count: 111,
    enDesc: "Power supply units, UPS batteries and power distribution accessories.",
    arDesc: "وحدات تجهيز الطاقة، بطاريات UPS، ومستلزمات توزيع الطاقة." },
  { key: "printers", en: "Printers & Consumables", ar: "الطابعات والمستلزمات", count: 106,
    enDesc: "Printer units, laser cartridges and liquid inks.",
    arDesc: "أجهزة طابعات، كاترجات ليزرية، وأحبار سائلة." },
  { key: "electrical", en: "Electrical & Smart Devices", ar: "الكهربائيات والأجهزة الذكية", count: 66,
    enDesc: "Audio equipment, speakers and smart home devices.",
    arDesc: "سماعات وصوتيات وأجهزة ذكية." },
  { key: "gaming", en: "Gaming", ar: "قسم الألعاب", count: 20,
    enDesc: "Gaming peripherals and accessories.",
    arDesc: "ملحقات ومستلزمات الألعاب." },
  { key: "bags", en: "Bags & Cases", ar: "الحقائب", count: 7,
    enDesc: "Laptop bags and protective carrying cases.",
    arDesc: "حقائب لابتوب وحقائب حماية." },
] as const;

export const TOTAL_SKUS = CATEGORIES.reduce((s, c) => s + c.count, 0);
