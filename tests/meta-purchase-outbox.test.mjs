import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { MetaPurchaseOutboxStore } from '../src/lib/analytics/meta-purchase-outbox-store.ts';

function event(eventId, eventTime) {
  return {
    eventName: 'Purchase',
    eventId,
    eventTime,
    eventSourceUrl: 'https://tsh.sale/en/cart',
    clientUserAgent: 'TSH outbox test agent',
    fbp: 'fb.1.1785701000.test-browser-id',
    customData: {
      content_ids: ['TSH-2342'],
      contents: [{ id: 'TSH-2342', quantity: 1, item_price: 6750 }],
      content_type: 'product',
      currency: 'IQD',
      value: 6750,
      num_items: 1,
    },
  };
}

async function withStore(run) {
  const directory = await mkdtemp(path.join(tmpdir(), 'tsh-meta-outbox-'));
  try {
    await run(new MetaPurchaseOutboxStore(directory), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('durably enqueues once, delivers once, and replaces PII with a sent tombstone', async () => {
  await withStore(async (store, directory) => {
    const now = Date.now();
    const purchase = event('tsh_purchase_test_delivery_001', Math.floor(now / 1_000));
    const first = await store.enqueue(purchase, now);
    assert.deepEqual(first, { created: true, state: 'pending' });

    let calls = 0;
    const deliver = async () => {
      calls += 1;
      return { sent: true, configured: true };
    };
    const [one, two] = await Promise.all([
      store.processEvent(purchase.eventId, deliver, now + 1),
      store.processEvent(purchase.eventId, deliver, now + 1),
    ]);
    assert.deepEqual(new Set([one, two]), new Set(['sent', 'skipped']));
    assert.equal(calls, 1);

    const duplicate = await store.enqueue(purchase, now + 2);
    assert.deepEqual(duplicate, { created: false, state: 'sent' });

    const [recordName] = await readdir(path.join(directory, 'records'));
    const record = await readFile(path.join(directory, 'records', recordName), 'utf8');
    assert.match(record, /"state":"sent"/);
    assert.doesNotMatch(record, /TSH outbox test agent|test-browser-id|TSH-2342/);
  });
});

test('keeps a failed delivery pending with backoff and retries when due', async () => {
  await withStore(async (store) => {
    const now = Date.now();
    const purchase = event('tsh_purchase_test_retry_002', Math.floor(now / 1_000));
    await store.enqueue(purchase, now);

    let calls = 0;
    const first = await store.processEvent(
      purchase.eventId,
      async () => {
        calls += 1;
        return { sent: false, configured: true };
      },
      now
    );
    assert.equal(first, 'retried');
    assert.equal(calls, 1);

    assert.equal(
      await store.processEvent(purchase.eventId, async () => ({ sent: true }), now + 30_000),
      'skipped'
    );
    assert.equal(
      await store.processEvent(
        purchase.eventId,
        async () => {
          calls += 1;
          return { sent: true };
        },
        now + 60_000
      ),
      'sent'
    );
    assert.equal(calls, 2);
  });
});

test('expires an event before Meta seven-day rejection and removes its payload', async () => {
  await withStore(async (store, directory) => {
    const now = Date.now();
    const old = event(
      'tsh_purchase_test_expired_003',
      Math.floor((now - 7 * 24 * 60 * 60 * 1_000) / 1_000)
    );
    await store.enqueue(old, now);
    let calls = 0;
    assert.equal(
      await store.processEvent(
        old.eventId,
        async () => {
          calls += 1;
          return { sent: true };
        },
        now
      ),
      'dead'
    );
    assert.equal(calls, 0);

    const [recordName] = await readdir(path.join(directory, 'records'));
    const record = await readFile(path.join(directory, 'records', recordName), 'utf8');
    assert.match(record, /"state":"dead"/);
    assert.doesNotMatch(record, /TSH outbox test agent|test-browser-id|TSH-2342/);
  });
});
