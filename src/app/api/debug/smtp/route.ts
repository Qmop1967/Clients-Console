// Debug endpoint for SMTP testing
// Protected by DEBUG_API_SECRET
import { NextRequest, NextResponse } from 'next/server';
import { createTransport } from 'nodemailer';
import { Redis } from '@upstash/redis';
import { validateDebugAuth } from '@/lib/auth/debug-auth';

export async function GET(request: NextRequest) {
  // Require authentication
  const authError = validateDebugAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const testEmail = searchParams.get('email');
  const testRedis = searchParams.get('redis') === 'true';

  // Check environment variables
  const envCheck = {
    SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
    SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
    SMTP_USER: process.env.SMTP_USER || 'NOT SET',
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ? 'SET (hidden)' : 'NOT SET',
    EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET (hidden)' : 'NOT SET',
  };

  // Test Redis connection if requested
  let redisStatus = 'not tested';
  if (testRedis) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      await redis.set('test-key', 'test-value', { ex: 60 });
      const value = await redis.get('test-key');
      redisStatus = value === 'test-value' ? 'working' : 'failed';
    } catch (error) {
      redisStatus = `error: ${error instanceof Error ? error.message : 'Unknown'}`;
    }
  }

  if (!process.env.SMTP_PASSWORD) {
    return NextResponse.json({
      success: false,
      error: 'SMTP_PASSWORD not configured',
      envCheck,
      redisStatus,
    });
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST || 'mail.privateemail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'noreply@tsh.sale',
      pass: process.env.SMTP_PASSWORD,
    },
  };

  try {
    const transport = createTransport(smtpConfig);

    // Verify connection
    await transport.verify();

    // If test email provided, send a test email with magic link style
    if (testEmail) {
      const testUrl = 'https://www.tsh.sale/api/auth/callback/nodemailer?token=test123';

      const html = `
        <!DOCTYPE html>
        <html dir="ltr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; margin: 0; font-size: 24px;">TSH</h1>
              <p style="color: #666; margin-top: 5px;">Clients Console - TEST EMAIL</p>
            </div>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              This is a TEST email simulating the magic link format.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${testUrl}" style="display: inline-block; background-color: #0070f3; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                Test Button (Don't Click)
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If you received this email, the SMTP configuration is working correctly!
            </p>
          </div>
        </body>
        </html>
      `;

      const result = await transport.sendMail({
        from: process.env.EMAIL_FROM || 'TSH <noreply@tsh.sale>',
        to: testEmail,
        subject: 'TSH Magic Link Test Email',
        html,
        text: `TSH Magic Link Test Email\n\nThis is a test email. If you received this, SMTP is working!\n\nTest URL: ${testUrl}`,
      });

      return NextResponse.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        messageId: result.messageId,
        envCheck,
        redisStatus,
        smtpConfig: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          user: smtpConfig.auth.user,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'SMTP connection verified successfully',
      envCheck,
      redisStatus,
      smtpConfig: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.auth.user,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: error instanceof Error ? error.stack : undefined,
      envCheck,
      redisStatus,
      smtpConfig: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        user: smtpConfig.auth.user,
      },
    });
  }
}
