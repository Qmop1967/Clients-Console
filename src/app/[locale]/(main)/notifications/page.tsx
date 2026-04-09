'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Package, Truck, CreditCard, FileText, Receipt, Megaphone, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  fetchNotifications,
  apiMarkAllAsRead,
  apiMarkAsRead,
  clearAll,
  type TshNotification,
} from '@/lib/notifications';

const typeIcons: Record<string, typeof Package> = {
  order: Package, shipping: Truck, payment: CreditCard,
  invoice: FileText, credit_note: Receipt, system: Megaphone,
};
const typeColors: Record<string, string> = {
  order: 'text-blue-500 bg-blue-500/10', shipping: 'text-orange-500 bg-orange-500/10',
  payment: 'text-green-500 bg-green-500/10', invoice: 'text-purple-500 bg-purple-500/10',
  credit_note: 'text-amber-500 bg-amber-500/10', system: 'text-slate-500 bg-slate-500/10',
};

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${dy} يوم`;
}

function groupByDate(notifications: TshNotification[]): { label: string; items: TshNotification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const groups = [
    { label: 'today', items: [] as TshNotification[] },
    { label: 'yesterday', items: [] as TshNotification[] },
    { label: 'older', items: [] as TshNotification[] },
  ];
  notifications.forEach(n => {
    if (n.timestamp >= today) groups[0].items.push(n);
    else if (n.timestamp >= yesterday) groups[1].items.push(n);
    else groups[2].items.push(n);
  });
  return groups.filter(g => g.items.length > 0);
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const [notifications, setNotifications] = useState<TshNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await fetchNotifications(50);
    setNotifications(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    await apiMarkAllAsRead();
    load();
  };
  const handleClearAll = () => { clearAll(); setNotifications([]); };
  const handleClick = async (n: TshNotification) => {
    if (!n.read) { await apiMarkAsRead(n.id); load(); }
  };

  const groups = groupByDate(notifications);
  const hasUnread = notifications.some(n => !n.read);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex gap-2">
          {hasUnread && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>{t('markAllRead')}</Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={handleClearAll}>
              <Trash2 className="h-3.5 w-3.5 me-1" />{t('clearAll')}
            </Button>
          )}
        </div>
      </div>
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent></Card>
      ) : notifications.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <p className="text-lg text-muted-foreground">{t('empty')}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">{t(group.label)}</h2>
              <Card><CardContent className="p-0 divide-y">
                {group.items.map(n => {
                  const Icon = typeIcons[n.type] || Megaphone;
                  const cc = typeColors[n.type] || typeColors.system;
                  return (
                    <div key={n.id} onClick={() => handleClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${!n.read ? 'bg-primary/5' : ''}`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cc}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                          {!n.read && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent></Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
