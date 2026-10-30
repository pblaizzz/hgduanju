'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowsOut, CaretLeft, CaretRight, CheckCircle, CircleNotch, FilmSlate, Play, SkipBack, SkipForward } from '@phosphor-icons/react';
import { fetchApi } from '@/lib/client';
import { formatTime } from '@/lib/media-utils';
import { readLibrary, saveWatchRecord } from '@/lib/library';
import { resumeEpisode } from '@/lib/resume';
import type { Drama, DramaDetail, Episode, PlaybackInfo, Source, WatchRecord } from '@/lib/types';
import { ErrorState, FavoriteButton } from './common';
import { EpisodePicker } from './detail-view';
import { sourceHref, useSource } from './providers';

export function WatchView({ id }: { id: string }) {
  const { source, ready } = useSource();
  const params = useSearchParams();
  const router = useRouter();
  const requestedEpisode = params.get('ep');
  const [detail, setDetail] = useState<DramaDetail | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [autoNext, setAutoNext] = useState(true);
  const [tab, setTab] = useState<'episodes' | 'about'>('episodes');
  const [notice, setNotice] = useState('');
  useEffect(() => { try { setAutoNext(localStorage.getItem('pianke-autonext') !== 'false'); } catch {} }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setDetail(null); setError(''); setSelectedId(''); setNotice('');
    fetchApi<DramaDetail>(`/api/catalog?view=detail&source=${source}&id=${encodeURIComponent(id)}`, controller.signal).then((result) => {
      const record = readLibrary().history.find((item) => item.drama.id === id && item.drama.source === source);
      const episode = requestedEpisode ? result.episodes.find((item) => item.id === requestedEpisode) : resumeEpisode(result.episodes, record);
      if (!episode) { setError('没有找到这个分集，请返回详情页重新选集。'); return; }
      if (!episode.playable) { setError('这一集暂不支持匿名观看，请选择其他分集。'); return; }
      setDetail(result); setSelectedId(episode.id);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [ready, id, source, requestedEpisode, retry]);
  const episode = detail?.episodes.find((item) => item.id === selectedId);
  const index = detail?.episodes.findIndex((item) => item.id === selectedId) ?? -1;
  const previous = detail?.episodes[index - 1];
  const next = detail?.episodes[index + 1];
  function choose(item: Episode) {
    if (!item.playable) { setNotice('这一集暂时不可播放，请选择其他分集。'); return; }
    router.replace(sourceHref(`/watch/${id}?ep=${encodeURIComponent(item.id)}`, source), { scroll: false });
  }
  function ended() {
    if (!next) setNotice('这一部故事，已经陪你看到最后。');
    else if (autoNext && next.playable) choose(next);
    else if (autoNext) setNotice(`第 ${next.number} 集暂时不可播放，自动连播已停止。`);
    else setNotice('本集已看完，可以选择下一集继续。');
  }
  return <div className="page-content watch-page"><div className="watch-breadcrumb"><Link className="back-link" href={sourceHref(`/drama/${id}`, source)}><ArrowLeft size={17} />剧集详情</Link><span>给自己一个沉浸的片刻</span></div>{error ? <ErrorState message={error} retry={() => setRetry((n) => n + 1)} /> : !detail || !episode ? <div className="player-loading"><CircleNotch size={34} className="spin" /><p>正在打开故事…</p></div> : <div className="watch-grid"><section className="watch-main"><VideoPlayer key={`${source}:${episode.id}`} drama={detail.drama} episode={episode} source={source} onEnded={ended} /><div className="watch-info"><div><h1>{detail.drama.title}</h1><p>第 {episode.number} 集<span> / 共 {detail.episodes.length} 集</span></p></div><FavoriteButton drama={detail.drama} compact /></div><div className="watch-toolbar"><div className="episode-navigation"><button className="button secondary" disabled={!previous?.playable} onClick={() => previous && choose(previous)}><SkipBack size={17} />上一集</button><button className="button primary" disabled={!next?.playable} onClick={() => next && choose(next)}>下一集<SkipForward size={17} /></button></div><label className="autonext-toggle"><input type="checkbox" checked={autoNext} onChange={(event) => { setAutoNext(event.target.checked); try { localStorage.setItem('pianke-autonext', String(event.target.checked)); } catch {} }} /><span className="switch-track" />自动连播</label></div>{notice && <div className="playback-notice" role="status"><CheckCircle size={19} />{notice}</div>}{source === 'demo' && <div className="sample-attribution"><FilmSlate size={18} /><span>当前播放：Big Buck Bunny 预告片 · Blender Foundation · CC BY 3.0<br /><small>体验片单中的每一集使用同一开放样片，便于验证播放、选集与续播。</small></span><a href="https://peach.blender.org/" target="_blank" rel="noreferrer">作品来源 <ArrowRight size={14} /></a></div>}</section><aside className="watch-sidebar"><div className="watch-tabs" role="tablist" aria-label="剧集信息"><button role="tab" aria-selected={tab === 'episodes'} onClick={() => setTab('episodes')}>选集<span>{detail.episodes.length}</span></button><button role="tab" aria-selected={tab === 'about'} onClick={() => setTab('about')}>简介</button></div>{tab === 'episodes' ? <div role="tabpanel"><p className="watch-episode-hint">正在观看 · 第 {episode.number} 集</p><EpisodePicker key={id} compact episodes={detail.episodes} selected={episode.id} onPick={choose} /><div className="sidebar-episode-nav"><button disabled={!previous?.playable} onClick={() => previous && choose(previous)}><CaretLeft size={16} />上一集</button><button disabled={!next?.playable} onClick={() => next && choose(next)}>下一集<CaretRight size={16} /></button></div></div> : <div role="tabpanel" className="watch-about"><h2>{detail.drama.title}</h2><p>{detail.drama.description || '暂无简介。'}</p><div className="detail-meta">{detail.drama.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>}</aside></div>}</div>;
}

function VideoPlayer({ drama, episode, source, onEnded }: { drama: Drama; episode: Episode; source: Source; onEnded: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<PlaybackInfo | null>(null);
  const [quality, setQuality] = useState('');
  const [rate, setRate] = useState(1);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const resumeAt = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const hasPlayed = useRef(false);
  const progress = useRef({ position: 0, duration: 0, completed: false });
  useEffect(() => {
    const record = readLibrary().history.find((item) => item.drama.id === drama.id && item.drama.source === source && item.episodeId === episode.id);
    resumeAt.current = record && !record.completed ? Math.max(0, record.position - 3) : 0;
  }, [drama.id, source, episode.id]);
  useEffect(() => {
    const controller = new AbortController();
    setPlayback(null); setError(''); setNeedsPlay(false); setPlaying(false);
    fetchApi<PlaybackInfo>(`/api/playback/${encodeURIComponent(episode.id)}?${new URLSearchParams({ source, quality })}`, controller.signal)
      .then(setPlayback).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [episode.id, source, quality, retry]);
  function persist() {
    if (!hasPlayed.current || !progress.current.duration) return;
    const record: WatchRecord = { drama, episodeId: episode.id, episodeNumber: episode.number, ...progress.current, updatedAt: Date.now() };
    setStorageError(!saveWatchRecord(record));
    lastSaved.current = Date.now();
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;
  useEffect(() => {
    const save = () => persistRef.current();
    const hidden = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hidden);
    return () => { save(); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  function updateProgress(ended = false) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    progress.current = { position: video.currentTime, duration: video.duration, completed: ended || (video.duration > 2 && video.currentTime >= video.duration - 0.5) };
    setElapsed(video.currentTime); setDuration(video.duration);
  }
  async function play() {
    try { await videoRef.current?.play(); setNeedsPlay(false); }
    catch { setNeedsPlay(true); }
  }
  function metadata() {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    if (resumeAt.current !== null && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(resumeAt.current, Math.max(0, video.duration - 1));
      resumeAt.current = null;
    }
    updateProgress();
    void play();
  }
  function fullscreen() {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (video?.requestFullscreen) void video.requestFullscreen().catch(() => {});
    else video?.webkitEnterFullscreen?.();
  }
  return <div className="video-player"><div className={`video-stage ${episode.vertical ? 'vertical-stage' : ''}`}>
    {error ? <div className="player-error"><FilmSlate size={38} /><h2>暂时无法播放这一集</h2><p role="alert">{error}</p><button className="button primary" onClick={() => { resumeAt.current = progress.current.position; setRetry((n) => n + 1); }}>重新尝试</button></div> : !playback ? <div className="player-loading"><CircleNotch size={34} className="spin" /><p>{source === 'live' ? '正在准备视频…' : '正在打开故事…'}</p>{source === 'live' && <small>首次播放需要准备媒体，请稍等片刻</small>}</div> : <><video ref={videoRef} src={playback.src} controls playsInline preload="auto" aria-label={`${drama.title}第${episode.number}集`} onLoadedMetadata={metadata} onPlay={() => { hasPlayed.current = true; setNeedsPlay(false); setPlaying(true); updateProgress(); persist(); }} onPause={() => { setPlaying(false); updateProgress(); persist(); }} onTimeUpdate={() => { updateProgress(); if (Date.now() - lastSaved.current > 5000) persist(); }} onSeeked={() => { updateProgress(); persist(); }} onEnded={() => { updateProgress(true); persist(); onEnded(); }} onError={() => setError('视频加载失败，请重试或更换清晰度。')} />{needsPlay && <button className="video-play-overlay" onClick={play}><span><Play size={31} weight="fill" /></span>点击开始播放</button>}</>}
    <span className="player-watermark">片刻剧场</span>
  </div><div className="player-bottom"><div className="play-status"><span className={playing ? 'status-playing' : ''}>{error ? '播放遇到问题' : !playback ? '正在准备' : playing ? '正在播放' : '已暂停'}</span><span className="time-display">{formatTime(elapsed)} <i>/</i> {formatTime(duration)}</span></div><div className="player-options"><label><span className="sr-only">播放速度</span><select aria-label="播放速度" value={rate} onChange={(event) => { const nextRate = Number(event.target.value); setRate(nextRate); if (videoRef.current) videoRef.current.playbackRate = nextRate; }}>{[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>{playback && <label><span className="sr-only">清晰度</span><select aria-label="清晰度" value={playback.quality} onChange={(event) => { resumeAt.current = videoRef.current?.currentTime || 0; updateProgress(); persist(); setQuality(event.target.value); }}>{playback.qualities.map((value) => <option key={value}>{value}</option>)}</select></label>}<button onClick={fullscreen} aria-label="全屏播放" disabled={!playback}><ArrowsOut size={19} /></button></div></div>{storageError && <p className="inline-error" role="alert">浏览器存储不可用，当前观看进度无法保存。</p>}</div>;
}
