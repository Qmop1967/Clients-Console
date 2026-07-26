import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const META_MEASUREMENT_CONSENT_COOKIE = 'tsh_measurement_consent_receipt_v2';
export const META_MEASUREMENT_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
export const META_CAPI_TEST_SESSION_COOKIE = 'tsh_meta_capi_test_session_v1';
export const META_CAPI_TEST_SESSION_MAX_AGE_SECONDS = 30 * 60;

const RECEIPT_VERSION = 'v2';
const FUTURE_SKEW_SECONDS = 5 * 60;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function consentSecret(): string {
  return process.env.META_MEASUREMENT_CONSENT_SECRET || '';
}

export function isMetaConsentVerificationConfigured(): boolean {
  return consentSecret().length >= 32;
}

function sign(payload: string): string {
  const secret = consentSecret();
  if (secret.length < 32) {
    throw new Error('Meta measurement consent verification is not configured');
  }
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function createSignedReceipt(version: string, issuedAt: number): string {
  const nonce = randomBytes(18).toString('base64url');
  const payload = `${version}.${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function createMetaMeasurementConsentReceipt(
  issuedAt = Math.floor(Date.now() / 1000)
): string {
  return createSignedReceipt(RECEIPT_VERSION, issuedAt);
}

export function hasValidMetaMeasurementConsent(receipt: string | undefined): boolean {
  if (!receipt || !isMetaConsentVerificationConfigured()) return false;

  const [version, rawIssuedAt, nonce, receivedSignature, ...extra] = receipt.split('.');
  if (
    extra.length ||
    version !== RECEIPT_VERSION ||
    !/^\d{10}$/.test(rawIssuedAt || '') ||
    !NONCE_PATTERN.test(nonce || '') ||
    !receivedSignature
  ) {
    return false;
  }

  const issuedAt = Number(rawIssuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (
    issuedAt > now + FUTURE_SKEW_SECONDS ||
    now - issuedAt > META_MEASUREMENT_CONSENT_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(sign(`${version}.${rawIssuedAt}.${nonce}`));
  const received = Buffer.from(receivedSignature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createMetaCapiTestSessionReceipt(issuedAt = Math.floor(Date.now() / 1000)): string {
  return createSignedReceipt('test-v1', issuedAt);
}

export function hasValidMetaCapiTestSession(receipt: string | undefined): boolean {
  if (!receipt || !isMetaConsentVerificationConfigured()) return false;
  const [version, rawIssuedAt, nonce, receivedSignature, ...extra] = receipt.split('.');
  if (
    extra.length ||
    version !== 'test-v1' ||
    !/^\d{10}$/.test(rawIssuedAt || '') ||
    !NONCE_PATTERN.test(nonce || '') ||
    !receivedSignature
  ) {
    return false;
  }

  const issuedAt = Number(rawIssuedAt);
  const now = Math.floor(Date.now() / 1000);
  if (
    issuedAt > now + FUTURE_SKEW_SECONDS ||
    now - issuedAt > META_CAPI_TEST_SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(sign(`${version}.${rawIssuedAt}.${nonce}`));
  const received = Buffer.from(receivedSignature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function metaCapiTestOperatorSecretMatches(candidate: string): boolean {
  const expected = process.env.META_CAPI_TEST_OPERATOR_SECRET || '';
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return (
    expected.length >= 32 &&
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}
