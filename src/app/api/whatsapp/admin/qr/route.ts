import { NextRequest, NextResponse } from 'next/server';
import { checkAdminConfig, isAdminAuthorized, getSessionQrCode } from '@/lib/wasender-admin';

export async function GET(req: NextRequest) {
  const cfg = checkAdminConfig();
  if (!cfg.configured) return NextResponse.json({ success: false, error: 'admin_not_configured', missing: cfg.missing }, { status: 503 });
  if (!isAdminAuthorized(req.headers.get('x-admin-key'))) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  try {
    const result = await getSessionQrCode(process.env.WASENDER_SESSION_ID!);
    return NextResponse.json(result.data, { status: result.status });
  } catch (err) {
    console.error('[Admin/qr] error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
