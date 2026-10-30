import { NextRequest, NextResponse } from 'next/server';
import { getCatalog, getDetail, getHotWords, getSuggestions } from '@/lib/server/catalog';
import { apiError, readKind, readSource } from '@/lib/server/http';
import { AppError } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const source = readSource(params);
    const view = params.get('view') || 'home';
    const query = (params.get('q') || '').trim();
    if (query.length > 100 || (params.get('cursor') || '').length > 16_000) throw new AppError('INVALID_OPTIONS', '查询内容过长。', 400);
    let result;
    if (view === 'detail') result = await getDetail(params.get('id') || '', source);
    else if (view === 'suggest') result = { items: await getSuggestions(query, source) };
    else if (view === 'hot') result = { items: await getHotWords(source) };
    else {
      if (!['home', 'rank', 'search'].includes(view)) throw new AppError('INVALID_OPTIONS', '页面参数无效。', 400);
      if (view === 'search' && !query) return NextResponse.json({ items: [], hasMore: false, source });
      result = await getCatalog({ source, view, query, kind: readKind(params), cursor: params.get('cursor') || '' });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
