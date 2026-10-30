import type { Drama, WatchRecord } from './types';

export const LIBRARY_KEY = 'pianke-library-v1';
export interface Library { favorites: Drama[]; history: WatchRecord[] }
const empty = (): Library => ({ favorites: [], history: [] });

function isDrama(value: unknown): value is Drama {
  if (!value || typeof value !== 'object') return false;
  const item = value as Drama;
  return typeof item.id === 'string' && typeof item.title === 'string' && typeof item.cover === 'string' &&
    (item.source === 'demo' || item.source === 'live') && Array.isArray(item.tags);
}

export function parseLibrary(raw: string | null): Library {
  if (!raw) return empty();
  try {
    const value = JSON.parse(raw);
    return {
      favorites: Array.isArray(value.favorites) ? value.favorites.filter(isDrama).slice(0, 100) : [],
      history: Array.isArray(value.history) ? value.history.filter((item: WatchRecord) =>
        isDrama(item?.drama) && typeof item.episodeId === 'string' && Number.isFinite(item.position) && item.position >= 0 &&
        Number.isFinite(item.episodeNumber) && Number.isFinite(item.duration) && Number.isFinite(item.updatedAt),
      ).slice(0, 40) : [],
    };
  } catch { return empty(); }
}

export function readLibrary(): Library {
  if (typeof window === 'undefined') return empty();
  try { return parseLibrary(localStorage.getItem(LIBRARY_KEY)); } catch { return empty(); }
}

export function writeLibrary(library: Library): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    window.dispatchEvent(new Event('pianke-library'));
    return true;
  } catch { return false; }
}

export function updateHistory(history: WatchRecord[], record: WatchRecord): WatchRecord[] {
  return [record, ...history.filter((item) => !(item.drama.id === record.drama.id && item.drama.source === record.drama.source))].slice(0, 40);
}

export function saveWatchRecord(record: WatchRecord): boolean {
  const library = readLibrary();
  return writeLibrary({ ...library, history: updateHistory(library.history, record) });
}
