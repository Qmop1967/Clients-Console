'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Link } from '@/i18n/navigation';
import { Palette, Type, Maximize2, Globe, Bell, User, Sun, Moon, Monitor, ChevronRight } from 'lucide-react';

type FontSize = 'small' | 'medium' | 'large';
type Density = 'compact' | 'normal' | 'comfortable';

const fontScales: Record<FontSize, number> = { small: 0.875, medium: 1, large: 1.125 };
const densityScales: Record<Density, number> = { compact: 0.85, normal: 1, comfortable: 1.15 };

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [density, setDensity] = useState<Density>('normal');
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifShipping, setNotifShipping] = useState(true);
  const [notifPayments, setNotifPayments] = useState(true);
  const [notifPromotions, setNotifPromotions] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved preferences
    const savedFont = localStorage.getItem('tsh-font-size') as FontSize;
    const savedDensity = localStorage.getItem('tsh-density') as Density;
    const savedNotifOrders = localStorage.getItem('tsh-notif-orders');
    const savedNotifShipping = localStorage.getItem('tsh-notif-shipping');
    const savedNotifPayments = localStorage.getItem('tsh-notif-payments');
    const savedNotifPromotions = localStorage.getItem('tsh-notif-promotions');

    if (savedFont && fontScales[savedFont]) setFontSize(savedFont);
    if (savedDensity && densityScales[savedDensity]) setDensity(savedDensity);
    if (savedNotifOrders !== null) setNotifOrders(savedNotifOrders === 'true');
    if (savedNotifShipping !== null) setNotifShipping(savedNotifShipping === 'true');
    if (savedNotifPayments !== null) setNotifPayments(savedNotifPayments === 'true');
    if (savedNotifPromotions !== null) setNotifPromotions(savedNotifPromotions === 'true');

    // Apply saved font scale
    if (savedFont && fontScales[savedFont as FontSize]) {
      document.documentElement.style.setProperty('--font-scale', String(fontScales[savedFont as FontSize]));
    }
    if (savedDensity && densityScales[savedDensity as Density]) {
      document.documentElement.style.setProperty('--display-density', String(densityScales[savedDensity as Density]));
    }
  }, []);

  const handleFontSize = (size: FontSize) => {
    setFontSize(size);
    localStorage.setItem('tsh-font-size', size);
    document.documentElement.style.setProperty('--font-scale', String(fontScales[size]));
  };

  const handleDensity = (d: Density) => {
    setDensity(d);
    localStorage.setItem('tsh-density', d);
    document.documentElement.style.setProperty('--display-density', String(densityScales[d]));
    // Apply density via zoom on main content area
    const mainEl = document.querySelector('main');
    if (mainEl) {
      (mainEl.style as any).zoom = String(densityScales[d]);
    }
  };

  const handleLocaleChange = (newLocale: string) => {
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  const handleNotifToggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    localStorage.setItem(key, String(value));
  };

  const currentLocale = pathname.split('/')[1] || 'ar';

  if (!mounted) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

      <div className="space-y-4">
        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              {t('appearance')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Theme */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('theme')}</p>
              <div className="flex gap-2">
                {[
                  { key: 'light', icon: Sun, label: t('themeLight') },
                  { key: 'dark', icon: Moon, label: t('themeDark') },
                  { key: 'system', icon: Monitor, label: t('themeSystem') },
                ].map(({ key, icon: Icon, label }) => (
                  <Button
                    key={key}
                    variant={theme === key ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setTheme(key)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <Type className="h-3.5 w-3.5 inline me-1" />
                {t('fontSize')}
              </p>
              <div className="flex gap-2">
                {[
                  { key: 'small' as FontSize, label: t('fontSmall'), sample: 'text-xs' },
                  { key: 'medium' as FontSize, label: t('fontMedium'), sample: 'text-sm' },
                  { key: 'large' as FontSize, label: t('fontLarge'), sample: 'text-base' },
                ].map(({ key, label, sample }) => (
                  <Button
                    key={key}
                    variant={fontSize === key ? 'default' : 'outline'}
                    size="sm"
                    className={`flex-1 ${sample}`}
                    onClick={() => handleFontSize(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Display Density */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                <Maximize2 className="h-3.5 w-3.5 inline me-1" />
                {t('displayDensity')}
              </p>
              <div className="flex gap-2">
                {[
                  { key: 'compact' as Density, label: t('densityCompact') },
                  { key: 'normal' as Density, label: t('densityNormal') },
                  { key: 'comfortable' as Density, label: t('densityComfortable') },
                ].map(({ key, label }) => (
                  <Button
                    key={key}
                    variant={density === key ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDensity(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              {t('language')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={currentLocale === 'ar' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleLocaleChange('ar')}
              >
                🇮🇶 العربية
              </Button>
              <Button
                variant={currentLocale === 'en' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => handleLocaleChange('en')}
              >
                🇬🇧 English
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              {t('notifications')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'tsh-notif-orders', label: t('notifOrders'), value: notifOrders, setter: setNotifOrders },
              { key: 'tsh-notif-shipping', label: t('notifShipping'), value: notifShipping, setter: setNotifShipping },
              { key: 'tsh-notif-payments', label: t('notifPayments'), value: notifPayments, setter: setNotifPayments },
              { key: 'tsh-notif-promotions', label: t('notifPromotions'), value: notifPromotions, setter: setNotifPromotions },
            ].map(({ key, label, value, setter }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={value}
                  onCheckedChange={(checked) => handleNotifToggle(key, checked, setter)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              {t('account')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/profile">
              <Button variant="outline" className="w-full justify-between">
                {t('viewProfile')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
