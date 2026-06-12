import { NextResponse } from 'next/server';

// Returns the build id currently running on the origin. VersionWatcher polls
// this to detect redeploys. Never cached (force-dynamic + no-store; nginx also
// forces no-store on /api). Public route (see middleware PUBLIC_PATHS) so it
// works on the login screen and before auth.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? 'unknown' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
