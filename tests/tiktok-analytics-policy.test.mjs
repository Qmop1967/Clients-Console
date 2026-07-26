import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeTikTokProperties } from '../src/lib/analytics/tiktok-policy.ts';

test('keeps exact catalog IDs but omits unsupported IQD money', () => {
  const result = sanitizeTikTokProperties({
    content_ids: [' TSH-2541 ', 'TSH-2541'],
    contents: [
      {
        content_id: 'TSH-2541',
        content_name: 'Gaming Headset',
        content_category: 'Headsets',
        quantity: 2,
        price: 9750,
      },
    ],
    content_type: 'product',
    currency: 'IQD',
    value: 19500,
  });

  assert.deepEqual(result.content_ids, ['TSH-2541']);
  assert.deepEqual(result.contents, [
    {
      content_id: 'TSH-2541',
      quantity: 2,
      content_name: 'Gaming Headset',
      content_category: 'Headsets',
    },
  ]);
  assert.equal(result.currency, undefined);
  assert.equal(result.value, undefined);
});

test('keeps USD commerce values without accepting unexpected PII fields', () => {
  const result = sanitizeTikTokProperties({
    content_ids: ['TSH-1000'],
    contents: [{ content_id: 'TSH-1000', quantity: 1, price: 12.5 }],
    content_type: 'product',
    currency: 'usd',
    value: 12.5,
    email: 'must-not-pass@example.com',
    phone: '+9640000000000',
  });

  assert.equal(result.currency, 'USD');
  assert.equal(result.value, 12.5);
  assert.deepEqual(result.contents, [
    { content_id: 'TSH-1000', quantity: 1, price: 12.5 },
  ]);
  assert.equal(result.email, undefined);
  assert.equal(result.phone, undefined);
});
