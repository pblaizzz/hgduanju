import { NextRequest, NextResponse } from 'next/server';
import { getPlaybackInfo } from '@/lib/server/media';
import { apiError, readSource } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const params = request.nextUrl.searchParams;
    const result = await getPlaybackInfo(id, readSource(params), (params.get('quality') || '').slice(0, 40));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
