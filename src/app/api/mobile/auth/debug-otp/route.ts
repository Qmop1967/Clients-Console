// ============================================
// DEBUG: OTP Flow Testing
// GET /api/mobile/auth/debug-otp
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Check environment variables
  results.tests = {
    ...results.tests as object,
    envVars: {
      hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      redisUrlPrefix: process.env.UPSTASH_REDIS_REST_URL?.substring(0, 30) + '...',
    },
  };

  try {
    // Test 2: Initialize Redis
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Test 3: Store a test value
    const testEmail = 'test@debug.com';
    const testCode = '123456';
    const redisKey = `mobile:otp:${testEmail.toLowerCase()}`;

    await redis.set(redisKey, testCode, { ex: 60 });
    results.tests = {
      ...results.tests as object,
      storeTest: {
        key: redisKey,
        storedValue: testCode,
        success: true,
      },
    };

    // Test 4: Retrieve the value
    const retrievedCode = await redis.get<string>(redisKey);
    results.tests = {
      ...results.tests as object,
      retrieveTest: {
        key: redisKey,
        retrievedValue: retrievedCode,
        matches: retrievedCode === testCode,
        success: retrievedCode === testCode,
      },
    };

    // Test 5: Check actual user's OTP (if exists)
    const userEmail = 'kha89ahm@gmail.com';
    const userKey = `mobile:otp:${userEmail.toLowerCase()}`;
    const userCode = await redis.get<string>(userKey);
    results.tests = {
      ...results.tests as object,
      userOtpCheck: {
        email: userEmail,
        key: userKey,
        hasStoredCode: !!userCode,
        storedCode: userCode || 'NONE',
      },
    };

    // Cleanup test
    await redis.del(redisKey);

    results.overallSuccess = true;
  } catch (error) {
    results.overallSuccess = false;
    results.error = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  return NextResponse.json(results);
}
