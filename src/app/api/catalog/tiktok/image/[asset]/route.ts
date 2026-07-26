import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { getApprovedPublicMedia } from '@/lib/odoo/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

function notFound() {
  return NextResponse.json({ error: 'not_found' }, {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string }> }
) {
  const { asset } = await params;
  const match = /^(\d+)-(\d+)\.jpe?g$/.exec(asset);
  if (!match) return notFound();

  const mediaId = Number(match[1]);
  const requestedVersion = Number(match[2]);
  if (!Number.isInteger(mediaId) || mediaId <= 0 || !Number.isInteger(requestedVersion)) {
    return notFound();
  }

  try {
    const [media] = await getApprovedPublicMedia(mediaId);
    if (
      !media
      || Number(media.asset_id) !== mediaId
      || Number(media.version || 1) !== requestedVersion
      || !String(media.mime_type || '').startsWith('image/')
      || typeof media.url !== 'string'
    ) {
      return notFound();
    }

    const sourceUrl = new URL(media.url);
    if (
      sourceUrl.protocol !== 'https:'
      || sourceUrl.hostname !== 'media.tsh.sale'
      || Boolean(sourceUrl.username || sourceUrl.password || sourceUrl.port)
    ) {
      return notFound();
    }

    const upstream = await fetch(sourceUrl, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return notFound();
    const contentType = upstream.headers.get('content-type') || '';
    const declaredSize = Number(upstream.headers.get('content-length') || 0);
    if (!contentType.startsWith('image/') || declaredSize > MAX_SOURCE_BYTES) return notFound();

    const source = Buffer.from(await upstream.arrayBuffer());
    if (!source.length || source.length > MAX_SOURCE_BYTES) return notFound();

    const jpeg = await sharp(source, { failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize(1200, 1200, { fit: 'contain', background: '#ffffff', withoutEnlargement: false })
      .jpeg({ quality: 90, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer();

    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpeg.length),
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('[TikTok Catalog] Image conversion failed:', { mediaId, error });
    return notFound();
  }
}
