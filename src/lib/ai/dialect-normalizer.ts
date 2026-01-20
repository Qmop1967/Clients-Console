// ============================================
// TSH Clients Console - Iraqi Dialect Normalizer
// Handles Iraqi colloquial → MSA fallback
// ============================================

// ============================================
// Iraqi Dialect → Modern Standard Arabic (MSA)
// ============================================

/**
 * Comprehensive Iraqi dialect to MSA mapping
 * Used as fallback when LLM doesn't understand Iraqi terms
 */
const IRAQI_TO_MSA_MAP: Record<string, string> = {
  // Question words
  شلون: 'كيف',
  شنو: 'ماذا',
  ش: 'ماذا',
  وين: 'أين',
  ويش: 'ماذا',
  شكد: 'كم',

  // Pronouns & common words
  انت: 'أنت',
  انتي: 'أنتِ',
  احنا: 'نحن',
  هاي: 'هذه',
  هذا: 'هذا',
  هالشي: 'هذا الشيء',

  // Want/Need
  ابي: 'أريد',
  اريد: 'أريد',
  ابغى: 'أريد',
  اباه: 'أريده',
  اريده: 'أريده',

  // Have/Found
  لكيت: 'وجدت',
  لقيت: 'وجدت',
  عندي: 'لدي',
  موجود: 'متوفر',
  مو: 'لا',
  ما: 'لا',

  // Common verbs
  اطلب: 'أطلب',
  اخذ: 'آخذ',
  اشتري: 'أشتري',
  اشوف: 'أرى',
  اسأل: 'أسأل',

  // Product-related terms
  جنطة: 'حافظة',
  محول: 'شاحن',
  سماعة: 'سماعة',
  فون: 'هاتف',
  موبايل: 'هاتف',
  تلفون: 'هاتف',

  // Quality/Condition
  زين: 'جيد',
  حلو: 'جيد',
  ماكو: 'لا يوجد',
  خلص: 'انتهى',

  // Quantities
  حبة: 'قطعة',
  قطعة: 'قطعة',
  كلهن: 'جميعهم',
  كلهم: 'جميعهم',

  // Yes/No
  اي: 'نعم',
  ايه: 'نعم',
  لا: 'لا',
  لاء: 'لا',

  // Time
  دحين: 'الآن',
  هسع: 'الآن',
  بعدين: 'بعد ذلك',

  // Common phrases
  شكرا: 'شكراً',
  تسلم: 'شكراً',
  ماشي: 'حسناً',
  تمام: 'حسناً',
  عظيم: 'ممتاز',
};

/**
 * Iraqi dialect product terms → English equivalents
 * For better semantic search matching
 */
const IRAQI_PRODUCT_TERMS: Record<string, string> = {
  جنطة: 'case',
  محول: 'charger',
  سماعة: 'earphone headphone',
  كيبل: 'cable',
  شاحن: 'charger',
  بطارية: 'battery',
  حماية: 'protection screen protector',
  شاشة: 'screen display',
  كاميرا: 'camera',
  سبيكر: 'speaker',
  باور: 'power bank',
};

// ============================================
// Normalization Functions
// ============================================

/**
 * Normalize Iraqi dialect query to MSA
 * Preserves English tech terms
 */
export function normalizeIraqiQuery(query: string): string {
  let normalized = query;

  // Replace Iraqi dialect terms with MSA
  for (const [iraqi, msa] of Object.entries(IRAQI_TO_MSA_MAP)) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${iraqi}\\b`, 'g');
    normalized = normalized.replace(regex, msa);
  }

  return normalized;
}

/**
 * Enhance query with English product terms
 * Improves semantic search for bilingual embeddings
 */
export function enhanceQueryWithEnglish(query: string): string {
  let enhanced = query;

  for (const [arabic, english] of Object.entries(IRAQI_PRODUCT_TERMS)) {
    if (query.includes(arabic)) {
      enhanced += ` ${english}`;
    }
  }

  return enhanced.trim();
}

/**
 * Detect language of query
 */
export function detectLanguage(text: string): 'ar' | 'en' | 'mixed' {
  const arabicChars = text.match(/[\u0600-\u06FF]/g);
  const englishChars = text.match(/[a-zA-Z]/g);

  const arabicCount = arabicChars?.length || 0;
  const englishCount = englishChars?.length || 0;

  if (arabicCount > englishCount * 2) {
    return 'ar';
  } else if (englishCount > arabicCount * 2) {
    return 'en';
  } else {
    return 'mixed';
  }
}

/**
 * Extract product intent from query
 * Identifies what the user is looking for
 */
export interface ProductIntent {
  type: 'search' | 'stock' | 'price' | 'order' | 'help';
  category?: string;
  brand?: string;
  quantity?: number;
  productKeywords: string[];
}

export function extractProductIntent(query: string): ProductIntent {
  const lowerQuery = query.toLowerCase();
  const normalized = normalizeIraqiQuery(query).toLowerCase();

  // Determine intent type
  let type: ProductIntent['type'] = 'search';

  // Stock inquiry
  if (
    lowerQuery.includes('متوفر') ||
    lowerQuery.includes('موجود') ||
    lowerQuery.includes('stock') ||
    lowerQuery.includes('available')
  ) {
    type = 'stock';
  }

  // Price inquiry
  if (
    lowerQuery.includes('سعر') ||
    lowerQuery.includes('price') ||
    lowerQuery.includes('كم') ||
    lowerQuery.includes('شكد')
  ) {
    type = 'price';
  }

  // Order intent
  if (
    lowerQuery.includes('اطلب') ||
    lowerQuery.includes('اريد') ||
    lowerQuery.includes('ابي') ||
    lowerQuery.includes('order') ||
    lowerQuery.match(/\d+/)
  ) {
    type = 'order';
  }

  // Help/General
  if (
    lowerQuery.includes('شلون') ||
    lowerQuery.includes('help') ||
    lowerQuery.includes('ساعد')
  ) {
    type = 'help';
  }

  // Extract brand names (common in Iraq)
  const brands = [
    'apple',
    'samsung',
    'nokia',
    'huawei',
    'xiaomi',
    'oppo',
    'vivo',
    'realme',
    'oneplus',
    'iphone',
    'galaxy',
  ];

  const detectedBrand = brands.find((brand) =>
    lowerQuery.includes(brand.toLowerCase())
  );

  // Extract quantity
  const quantityMatch = query.match(/(\d+)/);
  const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

  // Extract product keywords (remove common words)
  const stopWords = new Set([
    'اريد',
    'ابي',
    'شلون',
    'شنو',
    'عندك',
    'متوفر',
    'موجود',
    'كم',
    'سعر',
    'the',
    'a',
    'is',
    'are',
    'how',
    'what',
  ]);

  const keywords = normalized
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return {
    type,
    brand: detectedBrand,
    quantity,
    productKeywords: keywords,
  };
}

/**
 * Suggest Iraqi dialect responses
 * Provides natural-sounding Iraqi phrases for common scenarios
 */
export const IRAQI_RESPONSE_TEMPLATES = {
  greeting: [
    'هلا، شلون اساعدك؟',
    'اهلاً وسهلاً، شنو تحتاج؟',
    'مرحبا، شبيك؟',
  ],

  notFound: [
    'آسف، مالكيت هالمنتج',
    'ما عندنا هاي بالوقت الحالي',
    'للأسف مو موجود',
  ],

  outOfStock: [
    'خلص المخزون، بس رح يوصل قريب',
    'مو متوفر دحين، تريد أشوف بدائل؟',
    'ماكو بالمخزن الحين',
  ],

  addedToCart: [
    'تمام، انضاف للسلة',
    'زين، حطيته بالسلة',
    'اوكي، انضاف',
  ],

  priceFixed: [
    'آسف خال، الأسعار ثابتة حسب نوع حسابك',
    'السعر مو يتغير، بس ممكن توفر بكميات أكبر',
    'الأسعار محددة من النظام',
  ],

  help: [
    'أقدر أساعدك بـ:',
    'شنو تحتاج؟ أقدر:',
    'اخدمك بـ:',
  ],

  confirmation: [
    'تأكيد الطلب؟',
    'متأكد؟',
    'نكمل؟',
  ],

  thanks: [
    'شكراً! 🙏',
    'تسلم!',
    'الله يحفظك!',
  ],
};

/**
 * Get random Iraqi response template
 */
export function getIraqiResponse(
  type: keyof typeof IRAQI_RESPONSE_TEMPLATES
): string {
  const templates = IRAQI_RESPONSE_TEMPLATES[type];
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Clean and prepare query for search
 * Combines normalization and enhancement
 */
export function prepareQueryForSearch(query: string): string {
  // Step 1: Normalize Iraqi dialect to MSA
  const normalized = normalizeIraqiQuery(query);

  // Step 2: Enhance with English terms
  const enhanced = enhanceQueryWithEnglish(normalized);

  // Step 3: Clean up extra spaces
  return enhanced.replace(/\s+/g, ' ').trim();
}
