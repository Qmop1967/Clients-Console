import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_EVENT_AGE_MS = (7 * 24 * 60 * 60 - 15 * 60) * 1_000;
const LOCK_STALE_MS = 5 * 60 * 1_000;
const TOMBSTONE_RETENTION_MS = 35 * 24 * 60 * 60 * 1_000;
const MAX_ATTEMPTS = 24;
const RECORD_VERSION = 1 as const;

export interface DurableMetaPurchaseEvent {
  eventName: 'Purchase';
  eventId: string;
  eventTime: number;
  eventSourceUrl: string;
  customData?: {
    content_ids?: string[];
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
    content_type?: 'product';
    content_name?: string;
    content_category?: string;
    currency?: string;
    value?: number;
    num_items?: number;
  };
  clientIp?: string;
  clientUserAgent: string;
  fbp?: string;
  fbc?: string;
}

interface PendingRecord {
  version: typeof RECORD_VERSION;
  state: 'pending';
  event: DurableMetaPurchaseEvent;
  createdAt: number;
  attemptCount: number;
  nextAttemptAt: number;
}

interface SentRecord {
  version: typeof RECORD_VERSION;
  state: 'sent';
  eventId: string;
  createdAt: number;
  sentAt: number;
  attemptCount: number;
}

interface DeadRecord {
  version: typeof RECORD_VERSION;
  state: 'dead';
  eventId: string;
  createdAt: number;
  failedAt: number;
  attemptCount: number;
  reason: 'expired' | 'attempt_limit' | 'invalid_record';
}

type OutboxRecord = PendingRecord | SentRecord | DeadRecord;

export interface OutboxDeliveryResult {
  sent: boolean;
  configured?: boolean;
}

export interface OutboxProcessResult {
  examined: number;
  sent: number;
  retried: number;
  dead: number;
  skipped: number;
}

export interface OutboxEnqueueResult {
  created: boolean;
  state: OutboxRecord['state'];
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'EEXIST'
  );
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
  );
}

function recordKey(eventId: string): string {
  if (!EVENT_ID_PATTERN.test(eventId)) throw new Error('Invalid Meta Purchase event id');
  return createHash('sha256').update(eventId).digest('hex');
}

function validateRootDirectory(rootDirectory: string): string {
  const normalized = path.resolve(rootDirectory);
  if (!path.isAbsolute(rootDirectory) || normalized === path.parse(normalized).root) {
    throw new Error('Meta Purchase outbox directory must be a dedicated absolute path');
  }
  return normalized;
}

function validateEvent(event: DurableMetaPurchaseEvent, now: number): void {
  recordKey(event.eventId);
  if (event.eventName !== 'Purchase') throw new Error('Outbox accepts Purchase events only');
  if (!Number.isSafeInteger(event.eventTime) || event.eventTime <= 0) {
    throw new Error('Invalid Meta Purchase event time');
  }
  const nowSeconds = Math.floor(now / 1_000);
  if (event.eventTime > nowSeconds + 5 * 60) {
    throw new Error('Meta Purchase event time is in the future');
  }
  if (!event.eventSourceUrl || !event.clientUserAgent.trim()) {
    throw new Error('Meta Purchase source URL and user agent are required');
  }
}

function isOutboxRecord(value: unknown): value is OutboxRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<OutboxRecord>;
  if (record.version !== RECORD_VERSION) return false;
  if (record.state === 'pending') {
    return Boolean(
      record.event &&
        record.event.eventName === 'Purchase' &&
        EVENT_ID_PATTERN.test(record.event.eventId) &&
        Number.isFinite(record.createdAt) &&
        Number.isFinite(record.attemptCount) &&
        Number.isFinite(record.nextAttemptAt)
    );
  }
  return Boolean(
    (record.state === 'sent' || record.state === 'dead') &&
      typeof record.eventId === 'string' &&
      EVENT_ID_PATTERN.test(record.eventId) &&
      Number.isFinite(record.createdAt)
  );
}

function retryDelayMs(attemptCount: number): number {
  const schedule = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];
  return schedule[Math.min(Math.max(attemptCount - 1, 0), schedule.length - 1)];
}

export class MetaPurchaseOutboxStore {
  readonly rootDirectory: string;
  private readonly recordsDirectory: string;
  private readonly locksDirectory: string;
  private readonly temporaryDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = validateRootDirectory(rootDirectory);
    this.recordsDirectory = path.join(this.rootDirectory, 'records');
    this.locksDirectory = path.join(this.rootDirectory, 'locks');
    this.temporaryDirectory = path.join(this.rootDirectory, 'tmp');
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await Promise.all([
      mkdir(this.recordsDirectory, { recursive: true, mode: 0o700 }),
      mkdir(this.locksDirectory, { recursive: true, mode: 0o700 }),
      mkdir(this.temporaryDirectory, { recursive: true, mode: 0o700 }),
    ]);
  }

  private recordPath(eventId: string): string {
    return path.join(this.recordsDirectory, `${recordKey(eventId)}.json`);
  }

  private lockPath(eventId: string): string {
    return path.join(this.locksDirectory, `${recordKey(eventId)}.lock`);
  }

  private async readRecord(filePath: string): Promise<OutboxRecord | null> {
    try {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
      return isOutboxRecord(parsed) ? parsed : null;
    } catch (error) {
      if (isMissing(error)) return null;
      return null;
    }
  }

  private async atomicReplace(filePath: string, record: OutboxRecord): Promise<void> {
    const temporaryPath = path.join(
      this.temporaryDirectory,
      `${path.basename(filePath)}.${randomUUID()}.tmp`
    );
    const handle = await open(temporaryPath, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporaryPath, filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  private async acquireLock(eventId: string, now: number): Promise<(() => Promise<void>) | null> {
    const lockPath = this.lockPath(eventId);
    const tryCreate = async () => {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${now}\n`, 'utf8');
      await handle.close();
    };

    try {
      await tryCreate();
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const lockStat = await stat(lockPath).catch(() => null);
      if (!lockStat || now - lockStat.mtimeMs <= LOCK_STALE_MS) return null;
      await unlink(lockPath).catch(() => undefined);
      try {
        await tryCreate();
      } catch (retryError) {
        if (isAlreadyExists(retryError)) return null;
        throw retryError;
      }
    }

    return async () => {
      await unlink(lockPath).catch(() => undefined);
    };
  }

  async enqueue(event: DurableMetaPurchaseEvent, now = Date.now()): Promise<OutboxEnqueueResult> {
    validateEvent(event, now);
    await this.ensureDirectories();
    const filePath = this.recordPath(event.eventId);
    const record: PendingRecord = {
      version: RECORD_VERSION,
      state: 'pending',
      event,
      createdAt: now,
      attemptCount: 0,
      nextAttemptAt: now,
    };

    const handle = await open(filePath, 'wx', 0o600).catch(async (error) => {
      if (!isAlreadyExists(error)) throw error;
      const existing = await this.readRecord(filePath);
      return existing;
    });

    if (!handle || !('writeFile' in handle)) {
      const existing = handle as OutboxRecord | null;
      return { created: false, state: existing?.state ?? 'dead' };
    }

    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { created: true, state: 'pending' };
  }

  private async markDead(
    filePath: string,
    record: PendingRecord,
    now: number,
    reason: DeadRecord['reason']
  ): Promise<void> {
    await this.atomicReplace(filePath, {
      version: RECORD_VERSION,
      state: 'dead',
      eventId: record.event.eventId,
      createdAt: record.createdAt,
      failedAt: now,
      attemptCount: record.attemptCount,
      reason,
    });
  }

  private async processRecord(
    filePath: string,
    deliver: (event: DurableMetaPurchaseEvent) => Promise<OutboxDeliveryResult>,
    now: number
  ): Promise<'sent' | 'retried' | 'dead' | 'skipped'> {
    const initial = await this.readRecord(filePath);
    if (!initial || initial.state !== 'pending') return 'skipped';
    const release = await this.acquireLock(initial.event.eventId, now);
    if (!release) return 'skipped';

    try {
      const record = await this.readRecord(filePath);
      if (!record || record.state !== 'pending' || record.nextAttemptAt > now) return 'skipped';
      if (now - record.event.eventTime * 1_000 >= MAX_EVENT_AGE_MS) {
        await this.markDead(filePath, record, now, 'expired');
        return 'dead';
      }
      if (record.attemptCount >= MAX_ATTEMPTS) {
        await this.markDead(filePath, record, now, 'attempt_limit');
        return 'dead';
      }

      try {
        const result = await deliver(record.event);
        if (result.sent) {
          await this.atomicReplace(filePath, {
            version: RECORD_VERSION,
            state: 'sent',
            eventId: record.event.eventId,
            createdAt: record.createdAt,
            sentAt: now,
            attemptCount: record.attemptCount + 1,
          });
          return 'sent';
        }
      } catch {
        // Network/vendor failures remain retryable; raw vendor errors never enter the ledger.
      }

      const attemptCount = record.attemptCount + 1;
      await this.atomicReplace(filePath, {
        ...record,
        attemptCount,
        nextAttemptAt: now + retryDelayMs(attemptCount),
      });
      return 'retried';
    } finally {
      await release();
    }
  }

  async processEvent(
    eventId: string,
    deliver: (event: DurableMetaPurchaseEvent) => Promise<OutboxDeliveryResult>,
    now = Date.now()
  ): Promise<'sent' | 'retried' | 'dead' | 'skipped'> {
    await this.ensureDirectories();
    return this.processRecord(this.recordPath(eventId), deliver, now);
  }

  async processDue(
    deliver: (event: DurableMetaPurchaseEvent) => Promise<OutboxDeliveryResult>,
    options: { now?: number; limit?: number } = {}
  ): Promise<OutboxProcessResult> {
    await this.ensureDirectories();
    const now = options.now ?? Date.now();
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const candidates: Array<{ name: string; createdAt: number }> = [];
    const names = (await readdir(this.recordsDirectory)).filter((name) =>
      /^[a-f0-9]{64}\.json$/.test(name)
    );
    for (const name of names) {
      const record = await this.readRecord(path.join(this.recordsDirectory, name));
      if (record?.state === 'pending' && record.nextAttemptAt <= now) {
        candidates.push({ name, createdAt: record.createdAt });
      }
    }
    candidates.sort((a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name));
    const due = candidates.slice(0, limit);
    const result: OutboxProcessResult = {
      examined: due.length,
      sent: 0,
      retried: 0,
      dead: 0,
      skipped: 0,
    };

    for (const candidate of due) {
      const outcome = await this.processRecord(
        path.join(this.recordsDirectory, candidate.name),
        deliver,
        now
      );
      result[outcome] += 1;
    }
    await this.purgeExpiredTombstones(now);
    return result;
  }

  async purgeExpiredTombstones(now = Date.now()): Promise<number> {
    await this.ensureDirectories();
    let removed = 0;
    const names = (await readdir(this.recordsDirectory)).filter((name) =>
      /^[a-f0-9]{64}\.json$/.test(name)
    );
    for (const name of names) {
      const filePath = path.join(this.recordsDirectory, name);
      const record = await this.readRecord(filePath);
      if (!record || record.state === 'pending') continue;
      const terminalAt = record.state === 'sent' ? record.sentAt : record.failedAt;
      if (now - terminalAt > TOMBSTONE_RETENTION_MS) {
        await unlink(filePath).catch(() => undefined);
        removed += 1;
      }
    }
    return removed;
  }
}
