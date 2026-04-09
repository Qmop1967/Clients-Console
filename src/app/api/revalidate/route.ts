import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const SECRET = process.env.REVALIDATION_SECRET || 'tsh-revalidate-2024';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const path = request.nextUrl.searchParams.get('path') || '/';

  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ success: true, revalidated: path });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
