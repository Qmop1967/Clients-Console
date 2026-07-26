import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isExactPublicAuthPath,
  resolvePostLoginTarget,
} from '../src/lib/auth/route-policy.ts';

const locales = ['ar', 'en', 'ckb', 'kmr', 'tm'];

test('login and login/verify are public for every supported locale', () => {
  for (const locale of locales) {
    assert.equal(isExactPublicAuthPath(`/${locale}/login`), true);
    assert.equal(isExactPublicAuthPath(`/${locale}/login/verify`), true);
  }
});

test('adjacent and deeper login routes remain protected', () => {
  assert.equal(isExactPublicAuthPath('/ar/login/reset'), false);
  assert.equal(isExactPublicAuthPath('/ar/login/verify/extra'), false);
  assert.equal(isExactPublicAuthPath('/ar/orders/login'), false);
});

test('safe business callback is preserved', () => {
  assert.equal(
    resolvePostLoginTarget('ar', '?callbackUrl=%2Far%2Forders%3Fstatus%3Ddraft'),
    '/ar/orders?status=draft',
  );
});

test('missing callback falls back to the dashboard', () => {
  assert.equal(resolvePostLoginTarget('ar', ''), '/ar/dashboard');
});

test('login callbacks are rejected to prevent authentication loops', () => {
  assert.equal(
    resolvePostLoginTarget('ar', '?callbackUrl=%2Far%2Flogin'),
    '/ar/dashboard',
  );
  assert.equal(
    resolvePostLoginTarget('ar', '?callbackUrl=%2Far%2Flogin%2Fverify'),
    '/ar/dashboard',
  );
});

test('external and backslash callbacks are rejected', () => {
  assert.equal(resolvePostLoginTarget('ar', '?callbackUrl=%2F%2Fevil.example'), '/ar/dashboard');
  assert.equal(resolvePostLoginTarget('ar', '?callbackUrl=%2F%5Cevil.example'), '/ar/dashboard');
});
