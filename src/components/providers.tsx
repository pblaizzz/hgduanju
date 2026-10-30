'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Source } from '@/lib/types';
import { readLibrary, type Library } from '@/lib/library';

const defaultSource: Source = process.env.NEXT_PUBLIC_DEFAULT_SOURCE === 'demo' ? 'demo' : 'live';
const SourceContext = createContext({ source: defaultSource, ready: false, changeSource: (_source: Source) => {} });

export function SourceProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [stored, setStored] = useState<Source>(defaultSource);
  const [ready, setReady] = useState(false);
  const fromUrl = params.get('source');
  const source = fromUrl === 'demo' || fromUrl === 'live' ? fromUrl : stored;
  useEffect(() => {
    try { const previous = localStorage.getItem('pianke-source'); if (previous === 'demo' || previous === 'live') setStored(previous); } catch { /* Browsing still works without storage. */ }
    setReady(true);
  }, []);
  function changeSource(next: Source) {
    setStored(next);
    try { localStorage.setItem('pianke-source', next); } catch { /* URL keeps the current selection. */ }
    const nextParams = new URLSearchParams(params.toString());
    nextParams.set('source', next);
    const destination = /^\/(drama|watch)\//.test(pathname) ? '/' : pathname;
    router.replace(`${destination}?${nextParams}`, { scroll: false });
  }
  return <SourceContext.Provider value={{ source, ready, changeSource }}>{children}</SourceContext.Provider>;
}

export const useSource = () => useContext(SourceContext);

export function sourceHref(href: string, source: Source): string {
  return `${href}${href.includes('?') ? '&' : '?'}source=${source}`;
}

export function useLibrary() {
  const [library, setLibrary] = useState<Library>({ favorites: [], history: [] });
  useEffect(() => {
    const update = () => setLibrary(readLibrary());
    update();
    window.addEventListener('storage', update);
    window.addEventListener('pianke-library', update);
    return () => { window.removeEventListener('storage', update); window.removeEventListener('pianke-library', update); };
  }, []);
  return library;
}
