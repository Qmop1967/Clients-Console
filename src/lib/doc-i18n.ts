// ============================================
// Document i18n — invoice / credit note / receipt / statement labels
// Driven by res.partner.x_doc_language (NOT the UI locale).
// Numbers stay English (toLocaleString('en-US')) per TSH rules.
// Legal company name stays Arabic on all documents.
// ============================================

export type DocLang = 'ar' | 'en' | 'ckb' | 'kmr' | 'tm';

export const DOC_LANGS: DocLang[] = ['ar', 'en', 'ckb', 'kmr', 'tm'];

export const docDir = (l: DocLang): 'rtl' | 'ltr' =>
  l === 'en' || l === 'tm' ? 'ltr' : 'rtl';

export function normalizeDocLang(v?: string | null): DocLang {
  if (v && (DOC_LANGS as string[]).includes(v)) return v as DocLang;
  if (v === 'ku') return 'ckb'; // legacy value on x_language
  return 'ar';
}

type Labels = {
  invoice: string; verify: string; invoiceNumber: string; date: string;
  dueDate: string; currency: string; status: string; paid: string;
  unpaid: string; invoiceTo: string; baghdadIraq: string; iraq: string;
  products: string; pieces: string; description: string; notes: string;
  returnPolicy: string; subtotal: string; tax: string; total: string;
  paidAmount: string; amountDue: string; sellerStamp: string;
  buyerStamp: string; thanks: string;
  receipt: string; receiptNumber: string; officialReceipt: string;
  receivedFrom: string; amount: string; paymentMethod: string;
  collector: string; scanToVerify: string; creditNote: string;
  creditNoteNumber: string; statement: string;
  amountReceived: string; amountCollected: string; exchangeRate: string;
  usdEquivalent: string; iqdReceived: string; confirmed: string;
  customerBalance: string; beforePayment: string; afterPayment: string;
  customer: string; rep: string; printDate: string;
  balanceBefore: string; balanceAfter: string;
  refundTotal: string; totalCustomerBalance: string;
};

export const DOC_LABELS: Record<DocLang, Labels> = {
  ar: {
    invoice: 'فاتورة', verify: 'تحقق', invoiceNumber: 'رقم الفاتورة',
    date: 'التاريخ', dueDate: 'الاستحقاق', currency: 'العملة', status: 'الحالة',
    paid: 'مدفوعة', unpaid: 'غير مدفوعة', invoiceTo: 'فاتورة إلى',
    baghdadIraq: 'بغداد، العراق', iraq: 'العراق', products: 'منتج', pieces: 'قطعة',
    description: 'الوصف', notes: 'ملاحظات',
    returnPolicy: 'تُقبل المرتجعات خلال 7 أيام من تاريخ الشراء.',
    subtotal: 'المجموع الفرعي', tax: 'الضريبة', total: 'الإجمالي',
    paidAmount: 'المدفوع', amountDue: 'المتبقي',
    sellerStamp: 'ختم وتوقيع البائع', buyerStamp: 'ختم وتوقيع المشتري',
    thanks: 'شكراً لتعاملكم معنا',
    receipt: 'وصل قبض', receiptNumber: 'رقم الوصل', officialReceipt: 'وصل تحصيل رسمي',
    receivedFrom: 'استلمنا من', amount: 'المبلغ', paymentMethod: 'طريقة الدفع',
    collector: 'المحصّل', scanToVerify: 'امسح للتحقق من صحة الوصل',
    creditNote: 'إشعار دائن', creditNoteNumber: 'رقم الإشعار', statement: 'كشف حساب',
    amountReceived: 'المبلغ المستلم', amountCollected: 'المبلغ المحصّل', exchangeRate: 'سعر الصرف',
    usdEquivalent: 'المعادل بالدولار', iqdReceived: 'المبلغ المستلم بالدينار', confirmed: 'مؤكد',
    customerBalance: 'رصيد العميل', beforePayment: 'قبل الدفع', afterPayment: 'بعد الدفع',
    customer: 'العميل', rep: 'المندوب', printDate: 'تاريخ الطباعة',
    balanceBefore: 'الرصيد السابق', balanceAfter: 'الرصيد المتبقي',
    refundTotal: 'إجمالي المرتجع', totalCustomerBalance: 'رصيد العميل الكلي',
  },
  en: {
    invoice: 'Invoice', verify: 'Verify', invoiceNumber: 'Invoice No.',
    date: 'Date', dueDate: 'Due Date', currency: 'Currency', status: 'Status',
    paid: 'Paid', unpaid: 'Unpaid', invoiceTo: 'Invoice To',
    baghdadIraq: 'Baghdad, Iraq', iraq: 'Iraq', products: 'items', pieces: 'pcs',
    description: 'Description', notes: 'Notes',
    returnPolicy: 'Returns are accepted within 7 days of purchase.',
    subtotal: 'Subtotal', tax: 'Tax', total: 'Total',
    paidAmount: 'Paid', amountDue: 'Balance Due',
    sellerStamp: 'Seller stamp & signature', buyerStamp: 'Buyer stamp & signature',
    thanks: 'Thank you for your business',
    receipt: 'Payment Receipt', receiptNumber: 'Receipt No.', officialReceipt: 'Official Collection Receipt',
    receivedFrom: 'Received from', amount: 'Amount', paymentMethod: 'Payment Method',
    collector: 'Collector', scanToVerify: 'Scan to verify this receipt',
    creditNote: 'Credit Note', creditNoteNumber: 'Credit Note No.', statement: 'Account Statement',
    amountReceived: 'Amount Received', amountCollected: 'Amount Collected', exchangeRate: 'Exchange Rate',
    usdEquivalent: 'USD Equivalent', iqdReceived: 'Amount Received (IQD)', confirmed: 'Confirmed',
    customerBalance: 'Customer Balance', beforePayment: 'Before Payment', afterPayment: 'After Payment',
    customer: 'Customer', rep: 'Sales Rep', printDate: 'Print Date',
    balanceBefore: 'Previous Balance', balanceAfter: 'Remaining Balance',
    refundTotal: 'Refund Total', totalCustomerBalance: 'Total Balance',
  },
  ckb: {
    invoice: 'فاکتورە', verify: 'پشکنین', invoiceNumber: 'ژمارەی فاکتورە',
    date: 'بەروار', dueDate: 'کاتی پارەدان', currency: 'دراو', status: 'دۆخ',
    paid: 'دراوە', unpaid: 'نەدراوە', invoiceTo: 'فاکتورە بۆ',
    baghdadIraq: 'بەغدا، عێراق', iraq: 'عێراق', products: 'بەرهەم', pieces: 'پارچە',
    description: 'وەسف', notes: 'تێبینییەکان',
    returnPolicy: 'گەڕاندنەوە لە ماوەی 7 ڕۆژ لە بەرواری کڕینەوە وەردەگیرێت.',
    subtotal: 'کۆی بەشەکی', tax: 'باج', total: 'کۆی گشتی',
    paidAmount: 'دراو', amountDue: 'ماوە',
    sellerStamp: 'مۆر و واژووی فرۆشیار', buyerStamp: 'مۆر و واژووی کڕیار',
    thanks: 'سوپاس بۆ مامەڵەکردنتان لەگەڵمان',
    receipt: 'پسوولەی وەرگرتن', receiptNumber: 'ژمارەی پسوولە', officialReceipt: 'پسوولەی وەرگرتنی فەرمی',
    receivedFrom: 'وەرگیرا لە', amount: 'بڕ', paymentMethod: 'شێوازی پارەدان',
    collector: 'کۆکەرەوە', scanToVerify: 'سکان بکە بۆ پشکنینی دروستی پسوولە',
    creditNote: 'ئاگادارنامەی قەرز', creditNoteNumber: 'ژمارەی ئاگادارنامە', statement: 'کەشفی حیساب',
    amountReceived: 'بڕی وەرگیراو', amountCollected: 'بڕی کۆکراوە', exchangeRate: 'نرخی ئاڵوگۆڕ',
    usdEquivalent: 'هاوتای دۆلار', iqdReceived: 'بڕی وەرگیراو بە دینار', confirmed: 'پشتڕاستکراوە',
    customerBalance: 'باڵانسی کڕیار', beforePayment: 'پێش پارەدان', afterPayment: 'دوای پارەدان',
    customer: 'کڕیار', rep: 'نوێنەری فرۆشتن', printDate: 'بەرواری چاپ',
    balanceBefore: 'باڵانسی پێشوو', balanceAfter: 'باڵانسی ماوە',
    refundTotal: 'کۆی گەڕاوە', totalCustomerBalance: 'کۆی باڵانسی کڕیار',
  },
  kmr: {
    invoice: 'فاتورە', verify: 'ڤەکولین', invoiceNumber: 'ژمارا فاتورێ',
    date: 'بەروار', dueDate: 'دەمێ پارەدانێ', currency: 'دراڤ', status: 'رەوش',
    paid: 'هاتیە دان', unpaid: 'نەهاتیە دان', invoiceTo: 'فاتورە بۆ',
    baghdadIraq: 'بەغدا، عیراق', iraq: 'عیراق', products: 'بەرهەم', pieces: 'پارچە',
    description: 'پێناسە', notes: 'تێبینی',
    returnPolicy: 'ڤەگەڕاندن د ماوێ 7 ڕۆژان دا ژ بەروارا کڕینێ تێتە وەرگرتن.',
    subtotal: 'کۆیا بەشەکی', tax: 'باج', total: 'کۆیا گشتی',
    paidAmount: 'یا هاتیە دان', amountDue: 'یا مایی',
    sellerStamp: 'مۆر و ئیمزایا فرۆشکاری', buyerStamp: 'مۆر و ئیمزایا کڕیاری',
    thanks: 'سوپاس بۆ کارێ تە دگەل مە',
    receipt: 'پسوولا وەرگرتنێ', receiptNumber: 'ژمارا پسوولێ', officialReceipt: 'پسوولا وەرگرتنا فەرمی',
    receivedFrom: 'هاتە وەرگرتن ژ', amount: 'بڕ', paymentMethod: 'رێکا پارەدانێ',
    collector: 'کۆمکەر', scanToVerify: 'سکان بکە بۆ ڤەکولینا دروستیا پسوولێ',
    creditNote: 'ئاگەهداریا قەرزی', creditNoteNumber: 'ژمارا ئاگەهداریێ', statement: 'کەشفا حسابی',
    amountReceived: 'بڕێ وەرگرتی', amountCollected: 'بڕێ کۆمکری', exchangeRate: 'نرخێ ئالوگۆڕێ',
    usdEquivalent: 'هەڤتایێ دۆلاری', iqdReceived: 'بڕێ وەرگرتی ب دیناری', confirmed: 'پشتراستکری',
    customerBalance: 'باڵانسا کڕیاری', beforePayment: 'بەری پارەدانێ', afterPayment: 'پشتی پارەدانێ',
    customer: 'کڕیار', rep: 'نوینەرێ فرۆتنێ', printDate: 'بەروارا چاپێ',
    balanceBefore: 'باڵانسا بەرێ', balanceAfter: 'باڵانسا مایی',
    refundTotal: 'کۆیا ڤەگەڕاندی', totalCustomerBalance: 'باڵانسا گشتی یا کڕیاری',
  },
  tm: {
    invoice: 'Fatura', verify: 'Doğrula', invoiceNumber: 'Fatura No',
    date: 'Tarih', dueDate: 'Vade Tarihi', currency: 'Para Birimi', status: 'Durum',
    paid: 'Ödendi', unpaid: 'Ödenmedi', invoiceTo: 'Fatura Edilen',
    baghdadIraq: 'Bağdat, Irak', iraq: 'Irak', products: 'ürün', pieces: 'adet',
    description: 'Açıklama', notes: 'Notlar',
    returnPolicy: 'İadeler satın alma tarihinden itibaren 7 gün içinde kabul edilir.',
    subtotal: 'Ara Toplam', tax: 'Vergi', total: 'Genel Toplam',
    paidAmount: 'Ödenen', amountDue: 'Kalan',
    sellerStamp: 'Satıcı kaşe ve imzası', buyerStamp: 'Alıcı kaşe ve imzası',
    thanks: 'Bizimle çalıştığınız için teşekkürler',
    receipt: 'Tahsilat Makbuzu', receiptNumber: 'Makbuz No', officialReceipt: 'Resmî Tahsilat Makbuzu',
    receivedFrom: 'Tahsil edilen', amount: 'Tutar', paymentMethod: 'Ödeme Yöntemi',
    collector: 'Tahsildar', scanToVerify: 'Makbuzu doğrulamak için tarayın',
    creditNote: 'Alacak Dekontu', creditNoteNumber: 'Dekont No', statement: 'Hesap Özeti',
    amountReceived: 'Alınan Tutar', amountCollected: 'Tahsil Edilen Tutar', exchangeRate: 'Döviz Kuru',
    usdEquivalent: 'Dolar Karşılığı', iqdReceived: 'Dinar Olarak Alınan', confirmed: 'Onaylandı',
    customerBalance: 'Müşteri Bakiyesi', beforePayment: 'Ödeme Öncesi', afterPayment: 'Ödeme Sonrası',
    customer: 'Müşteri', rep: 'Satış Temsilcisi', printDate: 'Yazdırma Tarihi',
    balanceBefore: 'Önceki Bakiye', balanceAfter: 'Kalan Bakiye',
    refundTotal: 'İade Toplamı', totalCustomerBalance: 'Toplam Bakiye',
  },
};

export function docT(lang: DocLang): Labels {
  return DOC_LABELS[lang] || DOC_LABELS.ar;
}
