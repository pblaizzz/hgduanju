'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, LockSimple, Play } from '@phosphor-icons/react';
import { fetchApi } from '@/lib/client';
import { resumeEpisode } from '@/lib/resume';
import type { DramaDetail, Episode } from '@/lib/types';
import { artworkUrl, ErrorState, FavoriteButton, LoadingGrid, Poster } from './common';
import { sourceHref, useLibrary, useSource } from './providers';

export function DetailView({ id }: { id: string }) {
  const router = useRouter();
  const { source, ready } = useSource();
  const { history } = useLibrary();
  const [detail, setDetail] = useState<DramaDetail | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setDetail(null); setError('');
    fetchApi<DramaDetail>(`/api/catalog?view=detail&source=${source}&id=${encodeURIComponent(id)}`, controller.signal)
      .then(setDetail).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [id, source, ready, retry]);
  const record = history.find((item) => item.drama.id === id && item.drama.source === source);
  const start = detail ? resumeEpisode(detail.episodes, record) : undefined;
  return <div className="page-content detail-page"><Link className="back-link" href={sourceHref('/', source)}><ArrowLeft size={17} />返回发现</Link>{error ? <ErrorState message={error} retry={() => setRetry((n) => n + 1)} /> : !detail ? <LoadingGrid hero /> : <>
    <section className="detail-hero"><div className="detail-backdrop">{detail.drama.backdrop || detail.drama.cover ? <img src={artworkUrl(detail.drama)} alt="" /> : null}</div><div className="detail-poster"><Poster drama={detail.drama} hero /></div><div className="detail-copy"><p className="eyebrow">{source === 'demo' ? '片刻体验剧集' : '红果短剧'}</p><h1>{detail.drama.title}</h1><div className="detail-meta"><span>{detail.drama.status}</span>{detail.drama.tags.map((tag) => <span key={tag}>{tag}</span>)}{detail.drama.heat && <span>{detail.drama.heat}</span>}</div><p className="detail-description">{detail.drama.description || '故事简介暂未提供。'}</p><div className="button-row">{start ? <Link className="button primary" href={sourceHref(`/watch/${id}?ep=${encodeURIComponent(start.id)}`, source)}><Play weight="fill" size={18} />{record ? `继续观看 · 第 ${start.number} 集` : '立即播放'}</Link> : <button className="button primary" disabled>暂无可播放分集</button>}<FavoriteButton drama={detail.drama} /></div>{record && <p className="resume-note">上次看到第 {record.episodeNumber} 集{record.completed ? ' · 已看完' : ` ${Math.floor(record.position / 60)}分${Math.floor(record.position % 60)}秒`}</p>}{source === 'demo' && <p className="sample-note">体验剧名和简介为界面示例。每集播放同一段 Big Buck Bunny 开放样片。</p>}</div></section>
    <section className="detail-episodes"><div className="section-heading"><div><h2>选集播放 <span className="count-label">{detail.episodes.length} 集</span></h2><p>从喜欢的那一集开始</p></div><span className="muted-text">{detail.episodes.some((episode) => !episode.playable) ? '锁定分集暂不支持匿名观看' : '点击集数开始观看'}</span></div><EpisodePicker episodes={detail.episodes} selected={record?.episodeId} onPick={(episode) => router.push(sourceHref(`/watch/${id}?ep=${encodeURIComponent(episode.id)}`, source))} /></section>
  </>}</div>;
}

export function EpisodePicker({ episodes, selected, onPick, compact = false }: { episodes: Episode[]; selected?: string; onPick: (episode: Episode) => void; compact?: boolean }) {
  const [group, setGroup] = useState(0);
  const [reversed, setReversed] = useState(false);
  const groupSize = 30;
  const groups = Math.ceil(episodes.length / groupSize);
  const ordered = reversed ? [...episodes].reverse() : episodes;
  const shown = ordered.slice(group * groupSize, (group + 1) * groupSize);
  useEffect(() => {
    const index = ordered.findIndex((item) => item.id === selected);
    setGroup(index >= 0 ? Math.floor(index / groupSize) : 0);
  // Only follow playback selection changes; users can browse other groups freely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, reversed, episodes]);
  return <div className={`episode-picker ${compact ? 'compact' : ''}`}><div className="episode-toolbar"><div className="episode-groups">{groups > 1 && Array.from({ length: groups }, (_, index) => <button key={index} className={group === index ? 'active' : ''} onClick={() => setGroup(index)} aria-pressed={group === index}>{ordered[index * groupSize].number}–{ordered[Math.min((index + 1) * groupSize, episodes.length) - 1].number}</button>)}</div><button className="sort-button" onClick={() => { setReversed(!reversed); setGroup(0); }}>{reversed ? <ArrowUp size={15} /> : <ArrowDown size={15} />}{reversed ? '倒序' : '正序'}</button></div>{episodes.length > 0 ? <div className="episode-grid">{shown.map((episode) => <button key={episode.id} disabled={!episode.playable} className={selected === episode.id ? 'selected' : ''} onClick={() => onPick(episode)} aria-label={`第 ${episode.number} 集${!episode.playable ? '，暂不可播放' : ''}`} aria-current={selected === episode.id ? 'true' : undefined}>{selected === episode.id && <span className="playing-bars" aria-hidden="true"><i /><i /><i /></span>}{episode.number}{!episode.playable && <LockSimple size={12} />}</button>)}</div> : <p className="muted-text">暂无分集信息。</p>}</div>;
}
