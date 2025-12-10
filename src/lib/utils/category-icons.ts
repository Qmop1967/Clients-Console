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
  type LucideIcon,
} from "lucide-react";

/**
 * Maps category names to Lucide icons based on keywords
 * Uses fuzzy matching to find the best icon for each category
 */
export function getCategoryIcon(categoryName: string): LucideIcon {
  const iconMap: Record<string, LucideIcon> = {
    // Networking
    network: Network,
    networking: Network,
    router: Router,
    switch: Network,
    ethernet: Cable,
    lan: Network,
    wan: Network,

    // Security
    security: Shield,
    surveillance: Camera,
    cctv: Camera,
    camera: Camera,
    access: Lock,
    lock: Lock,
    alarm: Shield,

    // Computing
    computer: Monitor,
    pc: Monitor,
    desktop: Monitor,
    laptop: Laptop,
    notebook: Laptop,
    tablet: Tablet,
    server: Server,
    workstation: Monitor,

    // Components
    processor: Cpu,
    cpu: Cpu,
    storage: HardDrive,
    hdd: HardDrive,
    ssd: HardDrive,
    memory: Cpu,
    ram: Cpu,

    // Peripherals
    printer: Printer,
    scanner: Printer,
    keyboard: Keyboard,
    mouse: Mouse,
    headphone: Headphones,
    headset: Headphones,
    speaker: Headphones,
    audio: Headphones,

    // Mobile & Accessories
    phone: Smartphone,
    mobile: Smartphone,
    smartphone: Smartphone,
    accessory: Smartphone,
    accessories: Smartphone,
    case: Smartphone,

    // Power
    power: Zap,
    ups: Battery,
    battery: Battery,
    charger: Zap,
    adapter: Zap,
    psu: Zap,

    // Connectivity
    wireless: Wifi,
    wifi: Wifi,
    bluetooth: Wifi,
    cable: Cable,
    cables: Cable,
    connector: Usb,
    usb: Usb,

    // Wearables
    watch: Watch,
    smartwatch: Watch,
    wearable: Watch,
  };

  // Normalize the category name for matching
  const lowerName = categoryName.toLowerCase();

  // First, try exact match
  if (iconMap[lowerName]) {
    return iconMap[lowerName];
  }

  // Then, try to find a keyword within the category name
  for (const [keyword, Icon] of Object.entries(iconMap)) {
    if (lowerName.includes(keyword)) {
      return Icon;
    }
  }

  // Default icon for unmatched categories
  return Package;
}

/**
 * Get a color class for the category icon based on category type
 * Returns Tailwind color classes for icon styling
 */
export function getCategoryIconColor(categoryName: string): string {
  const lowerName = categoryName.toLowerCase();

  // Security - red/orange
  if (lowerName.includes('security') || lowerName.includes('surveillance') || lowerName.includes('camera')) {
    return 'text-red-500 dark:text-red-400';
  }

  // Networking - blue
  if (lowerName.includes('network') || lowerName.includes('router') || lowerName.includes('switch')) {
    return 'text-blue-500 dark:text-blue-400';
  }

  // Computing - purple
  if (lowerName.includes('computer') || lowerName.includes('laptop') || lowerName.includes('server')) {
    return 'text-purple-500 dark:text-purple-400';
  }

  // Power - yellow/amber
  if (lowerName.includes('power') || lowerName.includes('ups') || lowerName.includes('battery')) {
    return 'text-amber-500 dark:text-amber-400';
  }

  // Storage - green
  if (lowerName.includes('storage') || lowerName.includes('hdd') || lowerName.includes('ssd')) {
    return 'text-emerald-500 dark:text-emerald-400';
  }

  // Default - primary/gold
  return 'text-primary';
}
