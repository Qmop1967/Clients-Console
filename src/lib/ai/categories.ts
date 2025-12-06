// ============================================
// AI Category System - Category Hierarchy
// ============================================
// Defines the category structure for AI classification
// Optimized for IT/Electronics wholesale products
// ============================================

export interface CategoryNode {
  id: string;
  name: string;
  name_ar: string;
  icon?: string;
  children?: CategoryNode[];
}

export interface AIClassification {
  item_id: string;
  primary_category: string;
  sub_category: string;
  tertiary_category?: string;
  tags: string[];
  confidence: number;
  reasoning?: string;
  model: string;
  classified_at: string;
  // Fallback info
  zoho_category_id?: string;
  zoho_category_name?: string;
}

export interface CategoryWithProducts {
  id: string;
  name: string;
  name_ar: string;
  icon?: string;
  product_count: number;
  children?: CategoryWithProducts[];
}

// Main category hierarchy for AI classification
export const CATEGORY_HIERARCHY: CategoryNode[] = [
  {
    id: 'networking',
    name: 'Networking & Connectivity',
    name_ar: 'الشبكات والاتصال',
    icon: '🌐',
    children: [
      { id: 'routers', name: 'Routers & Modems', name_ar: 'الراوترات والمودم' },
      { id: 'switches', name: 'Switches & Hubs', name_ar: 'المفاتيح والموزعات' },
      { id: 'network-cables', name: 'Network Cables & Accessories', name_ar: 'كابلات الشبكة والملحقات' },
      { id: 'wireless-ap', name: 'Wireless Access Points', name_ar: 'نقاط الوصول اللاسلكية' },
      { id: 'network-tools', name: 'Network Tools', name_ar: 'أدوات الشبكات' },
    ],
  },
  {
    id: 'security',
    name: 'Security Systems',
    name_ar: 'أنظمة الأمان',
    icon: '🔒',
    children: [
      { id: 'cctv', name: 'CCTV Cameras', name_ar: 'كاميرات المراقبة' },
      { id: 'dvr-nvr', name: 'DVR/NVR Systems', name_ar: 'أجهزة التسجيل' },
      { id: 'access-control', name: 'Access Control', name_ar: 'التحكم بالدخول' },
      { id: 'alarm', name: 'Alarm Systems', name_ar: 'أنظمة الإنذار' },
      { id: 'intercom', name: 'Intercom Systems', name_ar: 'أنظمة الاتصال الداخلي' },
    ],
  },
  {
    id: 'computer-hardware',
    name: 'Computer Hardware',
    name_ar: 'أجهزة الكمبيوتر',
    icon: '💻',
    children: [
      { id: 'laptops-desktops', name: 'Laptops & Desktops', name_ar: 'أجهزة اللابتوب والكمبيوتر' },
      { id: 'components', name: 'Components (RAM, SSD, HDD)', name_ar: 'المكونات (ذاكرة، أقراص)' },
      { id: 'peripherals', name: 'Peripherals (Keyboard, Mouse)', name_ar: 'الملحقات (لوحة مفاتيح، ماوس)' },
      { id: 'monitors', name: 'Monitors & Displays', name_ar: 'الشاشات والعارضات' },
    ],
  },
  {
    id: 'power',
    name: 'Power & Batteries',
    name_ar: 'الطاقة والبطاريات',
    icon: '🔋',
    children: [
      { id: 'ups', name: 'UPS Systems', name_ar: 'أجهزة يو بي إس' },
      { id: 'batteries', name: 'Batteries', name_ar: 'البطاريات' },
      { id: 'power-adapters', name: 'Power Adapters', name_ar: 'محولات الطاقة' },
      { id: 'surge-protectors', name: 'Surge Protectors', name_ar: 'حماية التيار' },
    ],
  },
  {
    id: 'audio-video',
    name: 'Audio & Video',
    name_ar: 'الصوتيات والمرئيات',
    icon: '🎵',
    children: [
      { id: 'speakers', name: 'Speakers & Amplifiers', name_ar: 'السماعات والمكبرات' },
      { id: 'microphones', name: 'Microphones', name_ar: 'الميكروفونات' },
      { id: 'projectors', name: 'Projectors', name_ar: 'أجهزة العرض' },
      { id: 'av-cables', name: 'AV Cables', name_ar: 'كابلات الصوت والصورة' },
    ],
  },
  {
    id: 'cables-adapters',
    name: 'Cables & Adapters',
    name_ar: 'الكابلات والمحولات',
    icon: '🔌',
    children: [
      { id: 'usb-cables', name: 'USB Cables', name_ar: 'كابلات يو إس بي' },
      { id: 'hdmi-display', name: 'HDMI/Display Cables', name_ar: 'كابلات HDMI والعرض' },
      { id: 'power-cables', name: 'Power Cables', name_ar: 'كابلات الطاقة' },
      { id: 'converters', name: 'Converters & Adapters', name_ar: 'المحولات' },
    ],
  },
  {
    id: 'accessories',
    name: 'Accessories',
    name_ar: 'الإكسسوارات',
    icon: '🛠️',
    children: [
      { id: 'cases-bags', name: 'Cases & Bags', name_ar: 'الحقائب والحافظات' },
      { id: 'stands-mounts', name: 'Stands & Mounts', name_ar: 'الحوامل والقواعد' },
      { id: 'cleaning', name: 'Cleaning & Maintenance', name_ar: 'التنظيف والصيانة' },
      { id: 'miscellaneous', name: 'Miscellaneous', name_ar: 'متنوعات' },
    ],
  },
];

// Flat list of all category names for AI prompt
export const FLAT_CATEGORIES = CATEGORY_HIERARCHY.flatMap((cat) => [
  cat.name,
  ...(cat.children?.map((child) => `${cat.name} > ${child.name}`) || []),
]);

// Get category by ID
export function getCategoryById(id: string): CategoryNode | undefined {
  for (const cat of CATEGORY_HIERARCHY) {
    if (cat.id === id) return cat;
    const child = cat.children?.find((c) => c.id === id);
    if (child) return child;
  }
  return undefined;
}

// Get parent category for a sub-category
export function getParentCategory(subCategoryId: string): CategoryNode | undefined {
  for (const cat of CATEGORY_HIERARCHY) {
    if (cat.children?.some((c) => c.id === subCategoryId)) {
      return cat;
    }
  }
  return undefined;
}

// Find category by name (case-insensitive)
export function findCategoryByName(name: string): { primary?: CategoryNode; sub?: CategoryNode } {
  const normalizedName = name.toLowerCase().trim();

  for (const cat of CATEGORY_HIERARCHY) {
    if (cat.name.toLowerCase() === normalizedName) {
      return { primary: cat };
    }
    const child = cat.children?.find((c) => c.name.toLowerCase() === normalizedName);
    if (child) {
      return { primary: cat, sub: child };
    }
  }
  return {};
}

// Build category tree with product counts
export function buildCategoryTreeWithCounts(
  classifications: AIClassification[]
): CategoryWithProducts[] {
  // Count products per category
  const counts = new Map<string, number>();

  for (const c of classifications) {
    // Count primary
    const primaryCount = counts.get(c.primary_category) || 0;
    counts.set(c.primary_category, primaryCount + 1);

    // Count sub
    if (c.sub_category) {
      const subCount = counts.get(c.sub_category) || 0;
      counts.set(c.sub_category, subCount + 1);
    }
  }

  // Build tree with counts
  return CATEGORY_HIERARCHY.map((cat): CategoryWithProducts => ({
    id: cat.id,
    name: cat.name,
    name_ar: cat.name_ar,
    icon: cat.icon,
    product_count: counts.get(cat.name) || 0,
    children: cat.children?.map((child): CategoryWithProducts => ({
      id: child.id,
      name: child.name,
      name_ar: child.name_ar,
      icon: child.icon,
      product_count: counts.get(child.name) || 0,
    })),
  }));
}

// Convert hierarchy to react-d3-tree format
export interface TreeNode {
  name: string;
  attributes?: {
    count?: number;
    icon?: string;
    id?: string;
  };
  children?: TreeNode[];
}

export function convertToTreeData(
  categories: CategoryWithProducts[],
  locale: 'en' | 'ar' = 'en'
): TreeNode {
  return {
    name: locale === 'ar' ? 'جميع التصنيفات' : 'All Categories',
    attributes: {
      count: categories.reduce((sum, c) => sum + c.product_count, 0),
      icon: '📦',
      id: 'root',
    },
    children: categories.map((cat) => ({
      name: locale === 'ar' ? cat.name_ar : cat.name,
      attributes: {
        count: cat.product_count,
        icon: cat.icon,
        id: cat.id,
      },
      children: cat.children?.map((child) => ({
        name: locale === 'ar' ? child.name_ar : child.name,
        attributes: {
          count: child.product_count,
          id: child.id,
        },
      })),
    })),
  };
}
