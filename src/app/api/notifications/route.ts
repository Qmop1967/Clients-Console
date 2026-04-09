import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
const API_KEY = process.env.API_KEY || '';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.odooPartnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';
    const unread_only = searchParams.get('unread_only') || 'false';

    const res = await fetch(
      `${API_GATEWAY_URL}/api/notifications?limit=${limit}&offset=${offset}&unread_only=${unread_only}`,
      {
        headers: {
          'x-api-key': API_KEY,
          'x-user-id': String(session.user.id),
        },
        next: { revalidate: 0 },
      }
    );

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.odooPartnerId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notification_id } = body;

    if (action === 'mark_read' && notification_id) {
      const res = await fetch(`${API_GATEWAY_URL}/api/notifications/${notification_id}/read`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'x-user-id': String(session.user.id),
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'mark_all_read') {
      const res = await fetch(`${API_GATEWAY_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'x-user-id': String(session.user.id),
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Notifications API] POST Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
