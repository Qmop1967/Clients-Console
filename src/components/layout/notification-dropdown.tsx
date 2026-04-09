'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Package, Truck, CreditCard, FileText, Receipt, Megaphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  fetchNotifications,
  fetchUnreadCount,
  apiMarkAllAsRead,
  apiMarkAsRead,
  type TshNotification,
} from '@/lib/notifications';

const typeIcons: Record<string, typeof Package> = {
  order: Package,
  shipping: Truck,
  payment: CreditCard,
  invoice: FileText,
  credit_note: Receipt,
  system: Megaphone,
};

const typeColors: Record<string, string> = {
  order: 'text-blue-500 bg-blue-500/10',
  shipping: 'text-orange-500 bg-orange-500/10',
  payment: 'text-green-500 bg-green-500/10',
  invoice: 'text-purple-500 bg-purple-500/10',
  credit_note: 'text-amber-500 bg-amber-500/10',
  system: 'text-slate-500 bg-slate-500/10',
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  return `منذ ${days} يوم`;
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<TshNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const t = useTranslations('notifications');

  const refresh = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        fetchNotifications(10),
        fetchUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 60s for new notifications
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleMarkAllRead = async () => {
    await apiMarkAllAsRead();
    refresh();
  };

  const handleClick = async (n: TshNotification) => {
    if (!n.read) {
      await apiMarkAsRead(n.id);
      refresh();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 rounded-full transition-all hover:bg-secondary"
          aria-label={t('title')}
        >
          <Bell className="h-5 w-5 text-foreground/70" strokeWidth={1.5} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -end-0.5 -top-0.5 h-5 min-w-5 rounded-full p-0 text-[10px] flex items-center justify-center border-2 border-background animate-scale-in"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{t('title')}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleMarkAllRead}>
              <Check className="h-3 w-3 me-1" />
              {t('markAllRead')}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcons[n.type] || Megaphone;
              const colorClass = typeColors[n.type] || typeColors.system;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                      {!n.read && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.timestamp)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full text-xs h-8">
                {t('viewAll')}
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
