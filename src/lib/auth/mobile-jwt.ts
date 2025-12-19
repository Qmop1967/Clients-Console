// ============================================
// Mobile JWT Authentication Utilities
// ============================================
// This module provides JWT-based authentication for mobile apps
// Unlike web which uses cookies, mobile uses Bearer tokens

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { Redis } from '@upstash/redis';

// Initialize Redis for token storage
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// JWT Configuration
const JWT_SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
);
const JWT_ISSUER = 'tsh-mobile';
const JWT_AUDIENCE = 'tsh-clients-console';
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface MobileUser {
  id: string;
  email: string;
  name?: string;
  zohoContactId: string;
  priceListId: string;
  currencyCode: string;
}

export interface MobileJWTPayload extends JWTPayload {
  userId: string;
  email: string;
  name?: string;
  zohoContactId: string;
  priceListId: string;
  currencyCode: string;
  type: 'access' | 'refresh';
}

// Generate access token (short-lived)
export async function generateAccessToken(user: MobileUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    zohoContactId: user.zohoContactId,
    priceListId: user.priceListId,
    currencyCode: user.currencyCode,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

// Generate refresh token (long-lived)
export async function generateRefreshToken(user: MobileUser): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  // Store refresh token in Redis for revocation capability
  await redis.set(
    `mobile:refresh:${user.id}`,
    token,
    { ex: 30 * 24 * 60 * 60 } // 30 days in seconds
  );

  return token;
}

// Verify and decode JWT token
export async function verifyToken(token: string): Promise<MobileJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    return payload as MobileJWTPayload;
  } catch (error) {
    console.error('[Mobile JWT] Token verification failed:', error);
    return null;
  }
}

// Verify refresh token and check if it's still valid in Redis
export async function verifyRefreshToken(token: string, userId: string): Promise<boolean> {
  try {
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'refresh' || payload.userId !== userId) {
      return false;
    }

    // Check if token is still valid in Redis (not revoked)
    const storedToken = await redis.get(`mobile:refresh:${userId}`);
    return storedToken === token;
  } catch (error) {
    console.error('[Mobile JWT] Refresh token verification failed:', error);
    return false;
  }
}

// Revoke refresh token (logout)
export async function revokeRefreshToken(userId: string): Promise<void> {
  await redis.del(`mobile:refresh:${userId}`);
}

// Generate both tokens
export async function generateTokenPair(user: MobileUser): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const accessToken = await generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

// Store mobile verification token (for magic link - deprecated, use OTP instead)
export async function storeMobileVerificationToken(
  email: string,
  token: string
): Promise<void> {
  // Store with 24 hour expiry
  await redis.set(
    `mobile:verify:${token}`,
    email,
    { ex: 24 * 60 * 60 }
  );
}

// Verify mobile verification token (deprecated, use OTP instead)
export async function verifyMobileVerificationToken(
  token: string
): Promise<string | null> {
  const email = await redis.get<string>(`mobile:verify:${token}`);
  if (email) {
    // Delete token after use (one-time use)
    await redis.del(`mobile:verify:${token}`);
  }
  return email;
}

// Generate 6-digit OTP code
export function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Store OTP code for email verification
export async function storeOTPCode(
  email: string,
  code: string
): Promise<void> {
  // Store with 10 minute expiry
  await redis.set(
    `mobile:otp:${email.toLowerCase()}`,
    code,
    { ex: 10 * 60 } // 10 minutes
  );
}

// Verify OTP code
export async function verifyOTPCode(
  email: string,
  code: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  const storedCodeRaw = await redis.get(`mobile:otp:${normalizedEmail}`);

  // Redis may return the code as a number, so convert to string for comparison
  const storedCode = storedCodeRaw !== null ? String(storedCodeRaw) : null;

  console.log(`[OTP Verify] Email: ${normalizedEmail}, Input: "${code}", Stored: "${storedCode || 'none'}"`);

  if (storedCode && storedCode === code) {
    // Delete code after successful verification (one-time use)
    await redis.del(`mobile:otp:${normalizedEmail}`);
    console.log(`[OTP Verify] SUCCESS - Code matched and deleted`);
    return true;
  }

  console.log(`[OTP Verify] FAILED - Code mismatch or not found`);
  return false;
}

// Extract token from Authorization header
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
