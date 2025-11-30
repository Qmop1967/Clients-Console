import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export async function GET() {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Get all keys (for debugging only)
    const keys = await redis.keys('*');

    // Filter auth-related keys
    const authKeys = keys.filter((key: string) =>
      key.includes('user') ||
      key.includes('token') ||
      key.includes('verification') ||
      key.includes('session') ||
      key.includes('account')
    );

    // Get values for auth keys
    const authData: Record<string, unknown> = {};
    for (const key of authKeys.slice(0, 20)) { // Limit to 20 for safety
      try {
        const value = await redis.get(key);
        authData[key] = value;
      } catch {
        authData[key] = 'Error reading';
      }
    }

    return NextResponse.json({
      success: true,
      totalKeys: keys.length,
      authKeysCount: authKeys.length,
      authKeys: authKeys.slice(0, 20),
      authData,
      redisUrl: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
