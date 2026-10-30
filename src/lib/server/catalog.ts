import path from 'node:path';
import { createClient, SearchFilter, type Client, type Series, type SeriesDetail, type SeriesSummary } from 'openhongguo';
import { demoCatalog, demoDetail, demoDramas } from '../demo';
import { AppError, type Catalog, type ContentKind, type Drama, type DramaDetail, type Source } from '../types';
import { curlTransport } from './transport';

const state = globalThis as typeof globalThis & {
  piankeClient?: Promise<Client>;
  piankeCache?: Map<string, { expires: number; value: Promise<unknown> }>;
};

export function getClient(): Promise<Client> {
  state.piankeClient ??= createClient({
    profile: path.join(process.cwd(), '.cache', 'anonymous.json'),
    timeoutMs: 15_000,
    retryAttempts: 1,
    transport: curlTransport,
  }).catch((error) => { state.piankeClient = undefined; throw error; });
  return state.piankeClient;
}

export function cached<T>(key: string, load: () => Promise<T>, ttl = 90_000): Promise<T> {
  const cache = state.piankeCache ??= new Map();
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as Promise<T>;
  if (cache.size > 150) {
    for (const [k, v] of cache) if (v.expires <= Date.now()) cache.delete(k);
    if (cache.size > 150) cache.delete(cache.keys().next().value!);
  }
  const value = load().catch((error) => { cache.delete(key); throw error; });
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

export function normalizeDrama(series: SeriesSummary | Series, kind: ContentKind = 'all'): Drama {
  const detail = series as Series;
  const tags = (detail.rows ?? []).filter((row) => row.kind === 3 || row.kind === 9 || row.kind === 40).map((row) => row.text).slice(0, 3);
  return {
    id: series.id, title: series.title, description: series.description || '', cover: series.cover_url || '',
    episodeCount: series.episode_count || 0, tags,
    status: detail.right_text || (series.episode_count ? `${detail.status === 1 ? '全' : ''}${series.episode_count}集` : '短剧'),
    kind, source: 'live',
    heat: detail.heat ? `${(detail.heat / 10_000).toFixed(0)}万热度` : undefined,
  };
}

function normalizeDetail(detail: SeriesDetail): DramaDetail {
  return {
    drama: normalizeDrama(detail.series!), source: 'live',
    episodes: detail.episodes.map((ep) => ({ id: ep.id, number: ep.number, title: ep.title || `第 ${ep.number} 集`, playable: ep.playable, vertical: !!ep.vertical })),
  };
}

async function enrichSummaries(items: Drama[], client: Client): Promise<Drama[]> {
  const missing = items.filter((item) => !item.cover || !item.episodeCount).slice(0, 12);
  if (!missing.length) return items;
  try {
    const details = await client.getSeriesBatch(missing.map((item) => item.id));
    const byId = new Map(details.filter((item) => item.series).map((item) => [item.series!.id, item]));
    for (const [id, detail] of byId) await cached(`detail:${id}`, async () => normalizeDetail(detail));
    return items.map((item) => {
      const detail = byId.get(item.id);
      return detail?.series ? { ...normalizeDrama(detail.series, item.kind), heat: item.heat || normalizeDrama(detail.series).heat } : item;
    });
  } catch { return items; } // Optional artwork metadata must not hide an otherwise usable catalog.
}

export async function getCatalog(options: { source: Source; view?: string; query?: string; kind?: ContentKind; cursor?: string }): Promise<Catalog> {
  const { source, view = 'home', query = '', kind = 'all', cursor = '' } = options;
  if (source === 'demo') return demoCatalog(query, kind, view === 'rank');
  return cached(JSON.stringify(options), async () => {
    const client = await getClient();
    if (view === 'rank' || (kind === 'ai' && view !== 'search')) {
      const rank = await client.shortRank({
        content: { all: 'all', human: 'human', comic: 'comic_series_rank', ai: 'ai_playlet', film: 'all' }[kind], cursor,
      });
      return {
        items: await enrichSummaries(rank.items.filter((item) => item.series_id && item.title).map((item) => ({
          ...normalizeDrama({ id: item.series_id!, title: item.title!, cover_url: item.cover_url, episode_count: item.episode_count }, kind),
          heat: item.score,
        })), client), cursor: rank.cursor, hasMore: rank.has_more, source,
      };
    }
    const filters = { all: undefined, human: SearchFilter.ShortPlay, comic: SearchFilter.Comic, ai: SearchFilter.AIComic, film: SearchFilter.Film };
    const page = view === 'search'
      ? await client.search(query, { cursor, filters: filters[kind] ? [filters[kind]!] : undefined })
      : await client.discover({ channel: { all: '推荐', human: '真人剧', comic: '漫剧', ai: '推荐', film: '电影' }[kind], cursor });
    return { items: await enrichSummaries(page.items.map((series) => normalizeDrama(series, kind)), client), cursor: page.cursor, hasMore: page.has_more, source };
  });
}

export async function getDetail(id: string, source: Source): Promise<DramaDetail> {
  if (source === 'demo') return demoDetail(id);
  assertLiveId(id);
  return cached(`detail:${id}`, async () => {
    const client = await getClient();
    const [detail] = await client.getSeriesBatch([id]);
    if (!detail?.series) throw new AppError('CONTENT_UNAVAILABLE', '这部剧已下架或暂时无法访问。', 404);
    return normalizeDetail(detail);
  });
}

export async function getSuggestions(query: string, source: Source): Promise<string[]> {
  if (!query.trim()) return [];
  if (source === 'demo') return demoCatalog(query).items.map((item) => item.title).slice(0, 5);
  return cached(`suggest:${query}`, async () => (await (await getClient()).suggest(query)).map((item) => item.keyword || item.text).slice(0, 6));
}

export async function getHotWords(source: Source): Promise<string[]> {
  if (source === 'demo') return demoDramas.slice(0, 5).map((item) => item.title);
  return cached('hot', async () => {
    const result = await (await getClient()).hotSearch();
    return [...new Set([...(result.guesses ?? []).map((item) => item.title), ...(result.boards ?? []).flatMap((board) => (board.items ?? []).map((item) => item.title))])].slice(0, 8);
  });
}

export function assertLiveId(id: string): void {
  if (!/^\d{8,24}$/.test(id)) throw new AppError('INVALID_OPTIONS', '剧集编号无效。', 400);
}
