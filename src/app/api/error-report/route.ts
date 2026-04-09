// ============================================
// Error Reporting API (Fallback for Sentry)
// POST /api/error-report
// Logs errors to PM2 logs + optional Telegram webhook
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const errorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(5000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  timestamp: z.string().optional(),
  level: z.enum(['error', 'warning', 'info']).default('error'),
  extra: z.record(z.string(), z.unknown()).optional(),
});

// Rate limiting: max 10 reports per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60_000).unref?.();

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const limit = rateLimitMap.get(ip);
    if (limit && now < limit.resetAt) {
      if (limit.count >= 10) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
      }
      limit.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    }

    const body = await request.json();
    const validation = errorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid error report' }, { status: 400 });
    }

    const report = validation.data;
    const timestamp = report.timestamp || new Date().toISOString();

    // Log to PM2 (visible via pm2 logs tsh-clients)
    console.error(`[ERROR-REPORT] [${report.level.toUpperCase()}] ${timestamp}
  URL: ${report.url || 'N/A'}
  Message: ${report.message}
  Stack: ${report.stack?.slice(0, 500) || 'N/A'}
  UA: ${report.userAgent?.slice(0, 200) || 'N/A'}
  IP: ${ip}
  Extra: ${report.extra ? JSON.stringify(report.extra).slice(0, 300) : 'N/A'}`);

    // Optional: Send critical errors to Telegram webhook
    if (report.level === 'error' && process.env.TELEGRAM_ERROR_WEBHOOK) {
      try {
        const text = `🚨 *TSH Client Error*\n\n*URL:* ${report.url || 'N/A'}\n*Error:* \`${report.message.slice(0, 200)}\`\n*Time:* ${timestamp}\n*IP:* ${ip}`;
        await fetch(process.env.TELEGRAM_ERROR_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_ERROR_CHAT_ID || '',
            text,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {}); // Don't fail if Telegram is down
      } catch {
        // Silently ignore Telegram errors
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Error Report] Failed to process:', error);
    return NextResponse.json({ error: 'Failed to process error report' }, { status: 500 });
  }
}
