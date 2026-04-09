'use client';

export interface TshNotification {
  id: string | number;
  type: 'order' | 'shipping' | 'payment' | 'invoice' | 'credit_note' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

// Map Gateway notification types to our types
function mapType(t: string): TshNotification['type'] {
  if (t?.includes('order') || t?.includes('confirm')) return 'order';
  if (t?.includes('ship') || t?.includes('delivery')) return 'shipping';
  if (t?.includes('pay') || t?.includes('collection')) return 'payment';
  if (t?.includes('invoice')) return 'invoice';
  if (t?.includes('credit') || t?.includes('refund')) return 'credit_note';
  return 'system';
}

// Convert Gateway format to our format
function convertFromApi(n: any): TshNotification {
  return {
    id: n.id,
    type: mapType(n.type),
    title: n.title || n.x_title || '',
    message: n.message || n.x_message || '',
    timestamp: new Date(n.created_at || n.create_date).getTime(),
    read: !!n.is_read,
    link: n.data?.url || undefined,
  };
}

// ===== API-BASED FUNCTIONS =====

export async function fetchNotifications(limit = 20): Promise<TshNotification[]> {
  try {
    const res = await fetch(`/api/notifications?limit=${limit}`);
    const data = await res.json();
    if (data.success && data.data?.notifications) {
      return data.data.notifications.map(convertFromApi);
    }
  } catch (e) {
    console.warn('[Notifications] API fetch failed, falling back to local:', e);
  }
  // Fallback to localStorage
  return getLocalNotifications();
}

export async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch('/api/notifications?unread_only=true&limit=1');
    const data = await res.json();
    if (data.success && data.data?.total !== undefined) {
      return data.data.total;
    }
  } catch {
    // Fallback
  }
  return getLocalUnreadCount();
}

export async function apiMarkAsRead(id: string | number): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', notification_id: id }),
    });
  } catch {
    // Silent fail
  }
}

export async function apiMarkAllAsRead(): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
  } catch {
    // Silent fail
  }
}

// ===== LOCAL STORAGE FALLBACK =====

const STORAGE_KEY = 'tsh-notifications';

function getStorage(): TshNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getLocalNotifications(): TshNotification[] {
  return getStorage().sort((a, b) => b.timestamp - a.timestamp);
}

export function getLocalUnreadCount(): number {
  return getStorage().filter(n => !n.read).length;
}

export function addLocalNotification(n: Omit<TshNotification, 'id' | 'timestamp' | 'read'>): void {
  const notification: TshNotification = {
    ...n,
    id: 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: Date.now(),
    read: false,
  };
  const all = getStorage();
  all.unshift(notification);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
}

export function localMarkAsRead(id: string | number) {
  const all = getStorage();
  const idx = all.findIndex(n => String(n.id) === String(id));
  if (idx !== -1) {
    all[idx].read = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function localMarkAllAsRead() {
  const all = getStorage();
  all.forEach(n => n.read = true);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function clearAll() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  }
}

export function seedDemoNotifications() {
  // No longer needed — real notifications come from API
  // Keep empty for backward compat
}
