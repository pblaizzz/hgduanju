'use client';

import Link from 'next/link';
import { ArrowClockwise, ArrowRight, BookmarkSimple, Check, FilmSlate, Play } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { Drama, WatchRecord } from '@/lib/types';
import { readLibrary, writeLibrary } from '@/lib/library';
import { sourceHref, useLibrary, useSource } from './providers';

export function artworkUrl(drama: Drama): string {
  return drama.source === 'live' && drama.cover ? `/api/cover/${encodeURIComponent(drama.id)}` : drama.backdrop || drama.cover;
}

export function Poster({ drama, hero = false }: { drama: Drama; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = drama.source === 'live' ? artworkUrl(drama) : drama.cover;
  useEffect(() => setFailed(false), [url]);
  return <div className={`poster-art ${drama.source === 'demo' ? 'demo-poster' : ''} ${hero ? 'poster-hero' : ''}`}>{url && !failed ? <img src={url} alt={`${drama.title}封面`} loading={hero ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <div className="poster-fallback"><FilmSlate size={36} /><span>{drama.title}</span></div>}{drama.source === 'demo' && <div className="poster-title" aria-hidden="true"><span>片刻原创概念</span><strong>{drama.title}</strong><small>PIANKE THEATER</small></div>}</div>;
}

export function DramaCard({ drama, index, record }: { drama: Drama; index?: number; record?: WatchRecord }) {
  const href = sourceHref(record ? `/watch/${drama.id}` : `/drama/${drama.id}`, drama.source);
  return <article className="drama-card"><Link href={href} className="poster-link" aria-label={`${record ? '继续观看' : '查看'}${drama.title}`}><Poster drama={drama} /><span className="poster-corner">{drama.status || `${drama.episodeCount}集`}</span><div className="poster-hover"><span><Play size={21} weight="fill" /></span></div>{index !== undefined && <span className="rank-number">{String(index + 1).padStart(2, '0')}</span>}{record && <div className="card-progress"><i style={{ width: `${Math.min(100, record.duration ? record.position / record.duration * 100 : 0)}%` }} /></div>}</Link><div className="card-info"><Link href={href}>{drama.title}</Link><p>{record ? `第 ${record.episodeNumber} 集 · ${record.completed ? '已看完' : '继续观看'}` : drama.tags.length ? drama.tags.slice(0, 2).join(' / ') : drama.heat || (drama.source === 'demo' ? '体验剧集' : '红果短剧')}</p></div></article>;
}

export function FavoriteButton({ drama, compact = false }: { drama: Drama; compact?: boolean }) {
  const { favorites } = useLibrary();
  const [error, setError] = useState('');
  const saved = favorites.some((item) => item.id === drama.id && item.source === drama.source);
  function toggle() {
    const library = readLibrary();
    const next = saved ? library.favorites.filter((item) => !(item.id === drama.id && item.source === drama.source)) : [drama, ...library.favorites].slice(0, 100);
    setError(writeLibrary({ ...library, favorites: next }) ? '' : '浏览器存储不可用，无法保存收藏。');
  }
  return <div className="favorite-wrap"><button className={`button secondary ${compact ? 'icon-button' : ''}`} onClick={toggle} aria-label={saved ? '取消收藏' : '收藏剧集'} aria-pressed={saved}>{saved ? <Check size={19} /> : <BookmarkSimple size={19} />}{!compact && (saved ? '已收藏' : '加入收藏')}</button>{error && <span role="alert" className="inline-error">{error}</span>}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { source, changeSource } = useSource();
  return <div className="empty-state error-state" role="alert"><FilmSlate size={40} /><h2>故事稍等片刻</h2><p>{message}</p><div className="button-row">{retry && <button className="button primary" onClick={retry}><ArrowClockwise size={17} />重新加载</button>}{source === 'live' && <button className="button secondary" onClick={() => changeSource('demo')}>浏览体验片单 <ArrowRight size={17} /></button>}</div></div>;
}

export function LoadingGrid({ hero = false }: { hero?: boolean }) {
  return <div aria-label="正在加载剧集" aria-busy="true">{hero && <div className="skeleton skeleton-hero" />}<div className="poster-grid loading-grid">{Array.from({ length: 6 }, (_, i) => <div key={i}><div className="skeleton skeleton-poster" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>)}</div></div>;
}
