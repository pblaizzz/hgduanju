import { NextRequest } from 'next/server';
import { cached, getDetail } from '@/lib/server/catalog';
import { curlTransport } from '@/lib/server/transport';
import { AppError } from '@/lib/types';
import { apiError } from '@/lib/server/http';
import convert from 'heic-convert';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const image = await cached(`cover:${id}`, async () => {
      const { drama } = await getDetail(id, 'live');
      if (!/^https?:\/\//.test(drama.cover)) throw new AppError('CONTENT_UNAVAILABLE', '暂无封面。', 404);
      const response = await curlTransport({ method: 'GET', url: drama.cover, headers: {}, body: new Uint8Array() });
      const type = response.headers['content-type'] || '';
      if (response.status === 200 && /^image\/(heic|heif)(;|$)/i.test(type)) {
        const jpeg = await convert({ buffer: Buffer.from(response.body), format: 'JPEG', quality: 0.85 });
        return { bytes: new Uint8Array(jpeg), type: 'image/jpeg' };
      }
      if (response.status !== 200 || !/^image\/(jpeg|png|webp|avif|gif)(;|$)/i.test(type)) throw new AppError('CONTENT_UNAVAILABLE', '封面暂时无法加载。', 404);
      return { bytes: response.body, type };
    }, 300_000);
    return new Response(image.bytes as BodyInit, { headers: { 'Content-Type': image.type, 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return apiError(error); }
}
