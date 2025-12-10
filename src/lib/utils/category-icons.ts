import {
  Network,
  Shield,
  Monitor,
  Smartphone,
  Printer,
  Zap,
  HardDrive,
  Wifi,
  Camera,
  Server,
  Cable,
  Package,
  Cpu,
  Router,
  Lock,
  Headphones,
  Keyboard,
  Mouse,
  Laptop,
  Tablet,
  Watch,
  Battery,
  Usb,
  Droplets,
  Cctv,
  type LucideIcon,
} from "lucide-react";

// Icon configuration with both English and Arabic keywords
const iconConfig: Array<{
  icon: LucideIcon;
  keywords: string[];
  color: string;
  bgColor: string;
}> = [
  // Cameras & Surveillance
  {
    icon: Camera,
    keywords: [
      'camera', 'cameras', 'surveillance', 'cctv', 'dvr', 'nvr',
      'كاميرا', 'كاميرات', 'كامرات', 'كامرا', 'مراقبة', 'دي في ار'
    ],
    color: 'text-rose-500 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
  },
  // Routers & Networking
  {
    icon: Router,
    keywords: [
      'router', 'routers', 'routing',
      'راوتر', 'راوترات', 'موجه'
    ],
    color: 'text-blue-500 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  // Network & Internet
  {
    icon: Wifi,
    keywords: [
      'network', 'networking', 'internet', 'wifi', 'wireless', 'lan', 'wan',
      'انترنت', 'الانترنت', 'شبكة', 'شبكات', 'واي فاي', 'واير لس'
    ],
    color: 'text-sky-500 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
  },
  // Batteries & UPS
  {
    icon: Battery,
    keywords: [
      'battery', 'batteries', 'ups', 'power bank',
      'بطارية', 'بطاريات', 'يو بي اس', 'شحن'
    ],
    color: 'text-amber-500 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
  },
  // Chargers & Power Adapters
  {
    icon: Zap,
    keywords: [
      'charger', 'chargers', 'adapter', 'adapters', 'power', 'supply', 'psu',
      'شاحن', 'شواحن', 'محول', 'محولات', 'بورسبلاي', 'طاقة', 'تيار'
    ],
    color: 'text-yellow-500 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
  },
  // Computers & Laptops
  {
    icon: Laptop,
    keywords: [
      'laptop', 'laptops', 'notebook', 'لابتوب', 'لابتوبات', 'نوت بوك'
    ],
    color: 'text-violet-500 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    icon: Monitor,
    keywords: [
      'computer', 'computers', 'pc', 'desktop', 'workstation',
      'حاسب', 'حاسبات', 'حاسوب', 'كمبيوتر', 'كومبيوتر'
    ],
    color: 'text-purple-500 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  // Printers & Inks
  {
    icon: Printer,
    keywords: [
      'printer', 'printers', 'print', 'cartridge', 'toner', 'ink',
      'طابعة', 'طابعات', 'حبر', 'احبار', 'كاتريج', 'كاتريجات', 'ليزر', 'ليزرية'
    ],
    color: 'text-cyan-500 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
  },
  // Cables
  {
    icon: Cable,
    keywords: [
      'cable', 'cables', 'wire', 'wires', 'cord', 'ethernet',
      'كيبل', 'كيبلات', 'كابل', 'كوابل', 'سلك', 'اسلاك'
    ],
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/30',
  },
  // Mouse & Input
  {
    icon: Mouse,
    keywords: [
      'mouse', 'mice', 'ماوس', 'ماوسات', 'فأرة'
    ],
    color: 'text-indigo-500 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
  // Keyboard
  {
    icon: Keyboard,
    keywords: [
      'keyboard', 'keyboards', 'كيبورد', 'لوحة مفاتيح'
    ],
    color: 'text-fuchsia-500 dark:text-fuchsia-400',
    bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-950/30',
  },
  // Security
  {
    icon: Shield,
    keywords: [
      'security', 'secure', 'alarm', 'امن', 'امان', 'حماية', 'انذار'
    ],
    color: 'text-red-500 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
  },
  // Stands & Mounts
  {
    icon: Server,
    keywords: [
      'stand', 'stands', 'mount', 'mounts', 'rack',
      'ستاند', 'ستاندات', 'حامل', 'حوامل'
    ],
    color: 'text-zinc-500 dark:text-zinc-400',
    bgColor: 'bg-zinc-50 dark:bg-zinc-800/30',
  },
  // Storage
  {
    icon: HardDrive,
    keywords: [
      'storage', 'hdd', 'ssd', 'hard', 'disk', 'drive',
      'تخزين', 'هارد', 'قرص'
    ],
    color: 'text-emerald-500 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  // Audio
  {
    icon: Headphones,
    keywords: [
      'audio', 'headphone', 'headphones', 'speaker', 'sound',
      'سماعة', 'سماعات', 'صوت', 'اوديو'
    ],
    color: 'text-orange-500 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
  // Accessories (generic)
  {
    icon: Smartphone,
    keywords: [
      'accessory', 'accessories', 'ملحقات', 'اكسسوارات', 'قسم'
    ],
    color: 'text-teal-500 dark:text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
  },
];

// Default configuration
const defaultConfig = {
  icon: Package,
  color: 'text-primary',
  bgColor: 'bg-primary/10 dark:bg-primary/5',
};

/**
 * Find matching icon config for a category name
 */
function findIconConfig(categoryName: string | undefined | null) {
  if (!categoryName) {
    return defaultConfig;
  }

  const lowerName = categoryName.toLowerCase();

  // Find config where any keyword matches
  for (const config of iconConfig) {
    for (const keyword of config.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return config;
      }
    }
  }

  return defaultConfig;
}

/**
 * Maps category names to Lucide icons based on keywords
 * Supports both English and Arabic category names
 */
export function getCategoryIcon(categoryName: string | undefined | null): LucideIcon {
  return findIconConfig(categoryName).icon;
}

/**
 * Get a color class for the category icon based on category type
 * Returns Tailwind color classes for icon styling
 */
export function getCategoryIconColor(categoryName: string | undefined | null): string {
  return findIconConfig(categoryName).color;
}

/**
 * Get a background color class for the category icon container
 * Returns Tailwind background color classes
 */
export function getCategoryIconBgColor(categoryName: string | undefined | null): string {
  return findIconConfig(categoryName).bgColor;
}

/**
 * Get all styling for a category - icon, color, and background
 */
export function getCategoryStyle(categoryName: string | undefined | null) {
  const config = findIconConfig(categoryName);
  return {
    Icon: config.icon,
    color: config.color,
    bgColor: config.bgColor,
  };
}
