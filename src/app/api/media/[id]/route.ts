import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextRequest } from 'next/server';
import { parseRange } from '@/lib/media-utils';
import { prepareMedia } from '@/lib/server/media';
import { apiError } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 180;

async function serve(request: NextRequest, context: { params: Promise<{ id: string }> }, head = false) {
  try {
    const { id } = await context.params;
    const { file } = await prepareMedia(id, (request.nextUrl.searchParams.get('quality') || '').slice(0, 40));
    const { size } = await stat(file);
    const range = parseRange(request.headers.get('range'), size);
    if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const start = range?.start ?? 0;
    const end = range?.end ?? size - 1;
    const headers: Record<string, string> = {
      'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1), 'Cache-Control': 'private, max-age=1800',
    };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    if (head) return new Response(null, { status: range ? 206 : 200, headers });
    const stream = createReadStream(file, { start, end });
    request.signal.addEventListener('abort', () => stream.destroy(), { once: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
  } catch (error) { return apiError(error); }
}

export const GET = serve;
export function HEAD(request: NextRequest, context: { params: Promise<{ id: string }> }) { return serve(request, context, true); }
