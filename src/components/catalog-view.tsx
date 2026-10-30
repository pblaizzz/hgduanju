'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CaretRight, ClockCounterClockwise, Play, Sparkle, TrendUp } from '@phosphor-icons/react';
import { fetchApi } from '@/lib/client';
import type { Catalog, ContentKind, Drama } from '@/lib/types';
import { artworkUrl, DramaCard, ErrorState, FavoriteButton, LoadingGrid, Poster } from './common';
import { sourceHref, useLibrary, useSource } from './providers';

const kinds: { id: ContentKind; label: string }[] = [{ id: 'all', label: '为你推荐' }, { id: 'human', label: '真人短剧' }, { id: 'comic', label: '漫剧' }, { id: 'ai', label: 'AI 剧' }, { id: 'film', label: '影视剧' }];

export function CatalogView({ view = 'home' }: { view?: 'home' | 'search' | 'rank' }) {
  const { source, ready } = useSource();
  const params = useSearchParams();
  const query = view === 'search' ? params.get('q')?.trim() || '' : '';
  const [kind, setKind] = useState<ContentKind>('all');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hotWords, setHotWords] = useState<string[]>([]);
  const { history } = useLibrary();
  const effectiveView = view === 'search' && !query ? 'home' : view;
  const key = `${source}:${effectiveView}:${query}:${kind}`;
  const activeKey = useRef(key);
  activeKey.current = key;
  const [loadedKey, setLoadedKey] = useState('');
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setCatalog(null); setMoreLoading(false);
    const search = new URLSearchParams({ source, view: effectiveView, q: query, kind });
    fetchApi<Catalog>(`/api/catalog?${search}`, controller.signal)
      .then((result) => { setCatalog(result); setLoadedKey(key); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ready, source, effectiveView, query, kind, retry, key]);
  useEffect(() => {
    if (!ready || view !== 'search') return;
    const controller = new AbortController();
    setHotWords([]);
    fetchApi<{ items: string[] }>(`/api/catalog?view=hot&source=${source}`, controller.signal).then((result) => setHotWords(result.items)).catch(() => {});
    return () => controller.abort();
  }, [ready, source, view]);
  async function loadMore() {
    if (!catalog?.cursor || moreLoading) return;
    const requestedKey = key;
    setMoreLoading(true); setError('');
    try {
      const result = await fetchApi<Catalog>(`/api/catalog?${new URLSearchParams({ source, view: effectiveView, q: query, kind, cursor: catalog.cursor })}`);
      if (activeKey.current !== requestedKey) return;
      setCatalog((previous) => {
        if (!previous) return result;
        const seen = new Set(previous.items.map((item) => item.id));
        return { ...result, items: [...previous.items, ...result.items.filter((item) => !seen.has(item.id))] };
      });
    } catch (cause) { if (activeKey.current === requestedKey) setError((cause as Error).message); }
    finally { if (activeKey.current === requestedKey) setMoreLoading(false); }
  }
  const items = loadedKey === key ? catalog?.items || [] : [];
  const records = history.filter((record) => record.drama.source === source).slice(0, 4);
  return <div className="page-content catalog-page">
    {view !== 'home' && <div className="page-heading"><div><p className="eyebrow">{view === 'rank' ? '正在被喜欢的故事' : '找到下一部心动'}</p><h1>{view === 'rank' ? '人气榜单' : query ? `“${query}”的搜索结果` : '好故事，都在这里'}</h1></div>{view === 'rank' && <TrendUp size={31} className="heading-icon" />}</div>}
    <div className="category-bar" aria-label="内容类型">{kinds.map((item) => <button key={item.id} className={kind === item.id ? 'selected' : ''} aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>{item.label}</button>)}<span className="category-end">{view === 'home' ? '给自己留一段好时光' : source === 'demo' && view === 'rank' ? '体验片单顺序展示' : ''}</span></div>
    {view === 'search' && hotWords.length > 0 && <div className="hot-words"><span><TrendUp size={16} />大家在搜</span>{hotWords.slice(0, 6).map((word) => <Link key={word} href={sourceHref(`/search?q=${encodeURIComponent(word)}`, source)}>{word}</Link>)}</div>}
    {loading || !ready ? <LoadingGrid hero={view === 'home'} /> : error && !catalog ? <ErrorState message={error} retry={() => setRetry((n) => n + 1)} /> : <>
      {view === 'home' && items.length > 0 && <FeaturedHero key={key} items={items.slice(0, 3)} />}
      {view === 'home' && records.length > 0 && <section className="continue-section"><div className="section-heading"><h2><ClockCounterClockwise size={22} />继续你的故事</h2><Link href={sourceHref('/history', source)}>全部记录 <CaretRight size={15} /></Link></div><div className="continue-grid">{records.map((record) => <Link key={record.drama.id} href={sourceHref(`/watch/${record.drama.id}`, source)} className="continue-card"><Poster drama={record.drama} /><div><h3>{record.drama.title}</h3><p>第 {record.episodeNumber} 集 · {record.completed ? '已看完' : '上次看到这里'}</p><div className="continue-progress"><i style={{ width: `${Math.min(100, record.duration ? record.position / record.duration * 100 : 0)}%` }} /></div></div><Play size={23} weight="fill" /></Link>)}</div></section>}
      <section className="catalog-section"><div className="section-heading"><div><h2>{view === 'home' ? <><span className="section-accent" />值得一看的好剧</> : view === 'rank' ? '热门故事' : query ? `找到 ${items.length}${catalog?.hasMore ? '+' : ''} 部剧集` : '全部剧集'}</h2>{view === 'home' && <p>从这一集开始，遇见另一个世界</p>}</div>{view === 'home' && <Link href={sourceHref('/ranking', source)}>探索榜单 <ArrowRight size={16} /></Link>}</div>
        {items.length ? <div className="poster-grid">{items.map((drama, index) => <DramaCard key={drama.id} drama={drama} index={view === 'rank' ? index : undefined} />)}</div> : <div className="empty-state"><Sparkle size={37} /><h2>还没有找到这个故事</h2><p>换个关键词，或试试其他内容类型。</p></div>}
        {error && catalog && <p className="inline-error" role="alert">{error}</p>}
        {catalog?.hasMore && catalog.cursor && <div className="load-more"><button className="button secondary" disabled={moreLoading} onClick={loadMore}>{moreLoading ? '正在加载…' : error ? '重试加载更多' : '发现更多好剧'}<ArrowRight size={17} /></button></div>}
      </section>
      {view === 'home' && items.length > 0 && <div className="closing-note"><span className="closing-line" /><FilmNote /><span className="closing-line" /></div>}
    </>}
  </div>;
}

function FeaturedHero({ items }: { items: Drama[] }) {
  const [selected, setSelected] = useState(0);
  const drama = items[selected] || items[0];
  const [failed, setFailed] = useState(false);
  const background = artworkUrl(drama);
  return <section className={`featured-hero ${drama.source === 'live' ? 'live-hero' : ''}`} aria-label="精选剧集">
    {background && !failed && <img key={background} className="hero-background" src={background} alt="" onError={() => setFailed(true)} fetchPriority="high" />}
    <div className="hero-shade" />
    <div className="hero-copy"><div className="hero-kicker"><span />片刻精选<span className="hero-kicker-line" /></div><h1>{drama.title}</h1><div className="hero-meta"><span>{drama.status}</span>{drama.tags.map((tag) => <span key={tag}>{tag}</span>)}{drama.source === 'demo' && <span>体验剧集</span>}</div><p>{drama.description || '给自己留一段时间，走进这个故事。'}</p><div className="hero-actions"><Link className="button primary" href={sourceHref(`/drama/${drama.id}`, drama.source)}><Play size={18} weight="fill" />走进故事</Link><FavoriteButton drama={drama} compact /></div></div>
    <div className="hero-right-note">PIANKE<br /><span>STORIES WORTH YOUR TIME.</span></div>
    <div className="hero-selector" aria-label="切换精选剧集">{items.map((item, index) => <button key={item.id} className={index === selected ? 'active' : ''} onClick={() => { setSelected(index); setFailed(false); }} aria-label={`查看精选：${item.title}`} aria-pressed={index === selected}><Poster drama={item} /><span>{item.title}</span></button>)}</div>
    <div className="hero-counter"><strong>{String(selected + 1).padStart(2, '0')}</strong><span> / {String(items.length).padStart(2, '0')}</span></div>
  </section>;
}

function FilmNote() { return <p>生活有很多面，故事也是。<span>TAKE A MOMENT. FIND A STORY.</span></p>; }
