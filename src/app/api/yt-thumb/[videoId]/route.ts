import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(
  _req: NextRequest,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;

  // Validate videoId — only allow alphanumeric, hyphens, underscores
  if (!/^[\w-]{6,20}$/.test(videoId)) {
    return new NextResponse('Invalid video ID', { status: 400 });
  }

  const upstream = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const res = await fetch(upstream, { next: { revalidate: 604800 } });

    if (!res.ok) {
      return new NextResponse('Thumbnail fetch failed', { status: res.status });
    }

    const body = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache for 7 days in CDN/browser — replaces YouTube's 2h default
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch {
    return new NextResponse('Upstream error', { status: 502 });
  }
}
