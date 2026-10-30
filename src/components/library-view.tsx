'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, BookmarkSimple, ClockCounterClockwise, Trash } from '@phosphor-icons/react';
import { readLibrary, writeLibrary } from '@/lib/library';
import { DramaCard } from './common';
import { sourceHref, useLibrary, useSource } from './providers';

export function LibraryView({ historyMode = false }: { historyMode?: boolean }) {
  const { source } = useSource();
  const library = useLibrary();
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const favorites = library.favorites.filter((item) => item.source === source);
  const records = library.history.filter((item) => item.drama.source === source);
  const count = historyMode ? records.length : favorites.length;
  function clear() {
    const current = readLibrary();
    const next = historyMode ? { ...current, history: current.history.filter((item) => item.drama.source !== source) } : { ...current, favorites: current.favorites.filter((item) => item.source !== source) };
    setError(writeLibrary(next) ? '' : '浏览器存储不可用，无法清空记录。');
    setConfirm(false);
  }
  return <div className="page-content library-page"><div className="page-heading"><div><p className="eyebrow">留给自己的好故事</p><h1>{historyMode ? '观看记录' : '我的收藏'} <span className="count-label">{count}</span></h1><p className="muted-text">{historyMode ? '每一个暂停，都可以是下一次故事的开始。' : '把心动的故事留下，想看的时候随时回来。'}</p></div>{count > 0 && <div className="button-row">{confirm ? <><button className="text-button" onClick={() => setConfirm(false)}>取消</button><button className="text-button danger" onClick={clear}>确定清空</button></> : <button className="text-button" onClick={() => setConfirm(true)}><Trash size={16} />清空{historyMode ? '记录' : '收藏'}</button>}</div>}</div>{error && <p role="alert" className="inline-error">{error}</p>}{count ? <div className="poster-grid">{historyMode ? records.map((record) => <DramaCard key={record.drama.id} drama={record.drama} record={record} />) : favorites.map((drama) => <DramaCard key={drama.id} drama={drama} />)}</div> : <div className="empty-state">{historyMode ? <ClockCounterClockwise size={44} /> : <BookmarkSimple size={44} />}<h2>{historyMode ? '你的故事，从这里开始' : '还没有收藏的故事'}</h2><p>{historyMode ? '看过的剧集会出现在这里，随时接着看。' : '在剧集详情页点击收藏，就能把好剧留在这里。'}</p><Link className="button primary" href={sourceHref('/', source)}>去发现好剧 <ArrowRight size={17} /></Link></div>}</div>;
}
