import 'server-only';
import path from 'node:path';
import {
  MetaPurchaseOutboxStore,
  type DurableMetaPurchaseEvent,
  type OutboxProcessResult,
} from '@/lib/analytics/meta-purchase-outbox-store';
import {
  canSendMetaServerEvent,
  isMetaCapiConfigured,
  sendMetaServerEvent,
  type MetaServerEventInput,
} from '@/lib/analytics/meta-server';

const RAW_OUTBOX_DIRECTORY = process.env.META_CAPI_OUTBOX_DIR || '';

function configuredOutboxDirectory(): string | null {
  if (!RAW_OUTBOX_DIRECTORY || !path.isAbsolute(RAW_OUTBOX_DIRECTORY)) return null;
  const normalized = path.resolve(RAW_OUTBOX_DIRECTORY);
  return normalized === path.parse(normalized).root ? null : normalized;
}

let store: MetaPurchaseOutboxStore | null = null;

function getStore(): MetaPurchaseOutboxStore {
  const directory = configuredOutboxDirectory();
  if (!directory) throw new Error('Meta Purchase outbox is not configured');
  store ??= new MetaPurchaseOutboxStore(directory);
  return store;
}

function deliver(event: DurableMetaPurchaseEvent) {
  return sendMetaServerEvent(event as MetaServerEventInput, 'durable_outbox');
}

export function isMetaPurchaseOutboxConfigured(): boolean {
  return Boolean(
    configuredOutboxDirectory() &&
      isMetaCapiConfigured() &&
      canSendMetaServerEvent('Purchase', false, 'durable_outbox')
  );
}

export async function enqueueMetaPurchase(
  input: Omit<DurableMetaPurchaseEvent, 'eventName' | 'eventTime'> & { eventTime?: number }
): Promise<{ queued: boolean; delivered: boolean }> {
  if (!isMetaPurchaseOutboxConfigured()) return { queued: false, delivered: false };

  const event: DurableMetaPurchaseEvent = {
    ...input,
    eventName: 'Purchase',
    eventTime: input.eventTime ?? Math.floor(Date.now() / 1_000),
  };
  const outbox = getStore();
  const queued = await outbox.enqueue(event);
  const outcome = await outbox.processEvent(event.eventId, deliver);
  return {
    queued: queued.created || queued.state === 'pending' || queued.state === 'sent',
    delivered: outcome === 'sent' || queued.state === 'sent',
  };
}

export async function retryMetaPurchaseOutbox(limit = 25): Promise<OutboxProcessResult> {
  if (!isMetaPurchaseOutboxConfigured()) {
    throw new Error('Meta Purchase outbox is not configured');
  }
  return getStore().processDue(deliver, { limit });
}
