'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, BookmarkSimple, CaretRight, ClockCounterClockwise, Compass, FilmSlate, MagnifyingGlass, Play, SquaresFour, Trophy, X } from '@phosphor-icons/react';
import { fetchApi } from '@/lib/client';
import { sourceHref, useLibrary, useSource } from './providers';

const navigation = [
  { href: '/', label: '发现好剧', icon: Compass },
  { href: '/ranking', label: '人气榜单', icon: Trophy },
  { href: '/search', label: '全部剧集', icon: SquaresFour },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { source, changeSource } = useSource();
  const library = useLibrary();
  const watching = pathname.startsWith('/watch/');
  return <div className={`app-shell ${watching ? 'is-watching' : ''}`}>
    <a className="skip-link" href="#main">跳至主要内容</a>
    <aside className="sidebar">
      <Link className="brand" href={sourceHref('/', source)} aria-label="片刻剧场首页"><span className="brand-mark"><Play weight="fill" size={18} /></span><span>片刻<span className="brand-small">剧场</span></span></Link>
      <div className="sidebar-caption">发现一个好故事</div>
      <nav aria-label="主要导航" className="side-nav">{navigation.map(({ href, label, icon: Icon }) => <Link href={sourceHref(href, source)} key={href} className={pathname === href ? 'active' : ''} aria-current={pathname === href ? 'page' : undefined}><Icon size={21} weight={pathname === href ? 'fill' : 'regular'} /><span>{label}</span></Link>)}</nav>
      <div className="nav-divider" />
      <div className="sidebar-section-title">我的片刻</div>
      <nav aria-label="个人片单" className="side-nav">{[
        { href: '/library', label: '我的收藏', icon: BookmarkSimple, count: library.favorites.filter((item) => item.source === source).length },
        { href: '/history', label: '观看记录', icon: ClockCounterClockwise, count: library.history.filter((item) => item.drama.source === source).length },
      ].map(({ href, label, icon: Icon, count }) => <Link key={href} href={sourceHref(href, source)} className={pathname === href ? 'active' : ''} aria-current={pathname === href ? 'page' : undefined}><Icon size={21} /><span>{label}</span>{count > 0 && <small>{count}</small>}</Link>)}</nav>
      <div className="sidebar-bottom"><FilmSlate size={26} /><p>好故事，<br />值得留一会儿。</p><a href="https://github.com/beilunyang/openhongguo" target="_blank" rel="noreferrer">基于 openhongguo <ArrowUpRight size={13} /></a></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="mobile-brand"><Link className="brand" href={sourceHref('/', source)}><span className="brand-mark"><Play weight="fill" size={15} /></span>片刻</Link></div><SearchBox /><div className="topbar-right"><button className="source-switch" onClick={() => changeSource(source === 'live' ? 'demo' : 'live')} title="切换红果片单与体验片单"><FilmSlate size={17} /><span>{source === 'live' ? '红果片单' : '体验片单'}</span><CaretRight size={13} /></button><span className="guest-avatar" aria-label="本地访客">片</span></div></header>
      {source === 'demo' && <div className="demo-notice"><span>体验片单 · 剧名为界面示例，播放 Blender 开放样片</span><button onClick={() => changeSource('live')}>连接红果片单 <ArrowUpRight size={13} /></button></div>}
      <main id="main" tabIndex={-1}>{children}</main>
      {!watching && <footer className="footer"><span>片刻剧场<span className="footer-dot">·</span>给故事一点时间</span><span>观看进度保存在当前浏览器</span></footer>}
    </div>
    <nav className="mobile-nav" aria-label="移动导航">{[...navigation.slice(0, 2), { href: '/library', label: '收藏', icon: BookmarkSimple }, { href: '/history', label: '记录', icon: ClockCounterClockwise }].map(({ href, label, icon: Icon }) => <Link key={href} href={sourceHref(href, source)} className={pathname === href ? 'active' : ''}><Icon size={22} weight={pathname === href ? 'fill' : 'regular'} /><span>{label}</span></Link>)}</nav>
  </div>;
}

function SearchBox() {
  const { source, ready } = useSource();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ready || query.trim().length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchApi<{ items: string[] }>(`/api/catalog?view=suggest&source=${source}&q=${encodeURIComponent(query)}`, controller.signal)
        .then((result) => setSuggestions(result.items)).catch(() => setSuggestions([]));
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, source, ready]);
  useEffect(() => {
    function outside(event: MouseEvent) { if (!ref.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, []);
  function search(value: string) {
    if (!value.trim()) return;
    setQuery(value); setOpen(false);
    router.push(sourceHref(`/search?q=${encodeURIComponent(value.trim())}`, source));
  }
  function submit(event: FormEvent) { event.preventDefault(); search(query); }
  return <div className="search-box-wrap" ref={ref}><form onSubmit={submit} className="search-box" role="search"><MagnifyingGlass size={20} /><label className="sr-only" htmlFor="global-search">搜索剧名或关键词</label><input id="global-search" autoComplete="off" placeholder="搜一部好剧，开启你的片刻" value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setSuggestions([]); setOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} />{query && <button type="button" onClick={() => { setQuery(''); setSuggestions([]); }} aria-label="清空搜索"><X size={15} /></button>}<button className="search-submit" type="submit" aria-label="搜索"><span>搜索</span><MagnifyingGlass size={17} /></button></form>{open && query.trim() && suggestions.length > 0 && <div className="search-suggestions" aria-label="搜索建议">{suggestions.map((item) => <button key={item} onClick={() => search(item)}><MagnifyingGlass size={16} />{item}<CaretRight size={14} /></button>)}</div>}</div>;
}
