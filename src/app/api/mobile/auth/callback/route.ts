// ============================================
// Mobile Auth: Web Callback for Magic Link
// GET /api/mobile/auth/callback?token=xxx
// This is the fallback when user clicks email link in browser
// ============================================

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    // Redirect to error page
    return NextResponse.redirect(
      new URL('/login?error=invalid_token', request.nextUrl.origin)
    );
  }

  // Verify the token exists (but don't consume it yet)
  // The mobile app will consume it via POST /api/mobile/auth/verify

  // Generate HTML page that attempts to open the app
  const appLink = `tsh://auth/verify?token=${token}`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فتح تطبيق TSH | Open TSH App</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      direction: rtl;
    }
    .container {
      background: white;
      border-radius: 24px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      padding: 48px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    h1 {
      font-size: 24px;
      color: #1e293b;
      margin-bottom: 12px;
    }
    p {
      font-size: 16px;
      color: #64748b;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      color: #94a3b8;
      font-size: 14px;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e2e8f0, transparent);
      margin: 24px 0;
    }
    .manual-text {
      font-size: 14px;
      color: #94a3b8;
    }
    .token-display {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      margin-top: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📱</div>
    <h1>فتح تطبيق TSH</h1>
    <p>جاري محاولة فتح التطبيق...</p>

    <div class="spinner"></div>
    <p class="loading-text">يرجى الانتظار</p>

    <div class="divider"></div>

    <p style="margin-bottom: 16px;">إذا لم يفتح التطبيق تلقائياً:</p>
    <a href="${appLink}" class="btn">اضغط هنا لفتح التطبيق</a>

    <div class="divider"></div>

    <p class="manual-text">
      أو انسخ هذا الرمز وأدخله في التطبيق يدوياً:
    </p>
    <div class="token-display">${token}</div>
  </div>

  <script>
    // Try to open the app automatically
    setTimeout(function() {
      window.location.href = '${appLink}';
    }, 1000);

    // Fallback: try again after 3 seconds
    setTimeout(function() {
      window.location.href = '${appLink}';
    }, 3000);
  </script>
</body>
</html>
`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
