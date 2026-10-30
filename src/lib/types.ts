export type Source = 'live' | 'demo';
export type ContentKind = 'all' | 'human' | 'comic' | 'ai' | 'film';

export interface Drama {
  id: string;
  title: string;
  description: string;
  cover: string;
  backdrop?: string;
  episodeCount: number;
  tags: string[];
  status: string;
  kind: ContentKind;
  heat?: string;
  source: Source;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  playable: boolean;
  vertical: boolean;
}

export interface Catalog {
  items: Drama[];
  cursor?: string;
  hasMore: boolean;
  source: Source;
}

export interface DramaDetail {
  drama: Drama;
  episodes: Episode[];
  source: Source;
}

export interface PlaybackInfo {
  src: string;
  quality: string;
  qualities: string[];
  source: Source;
}

export interface WatchRecord {
  drama: Drama;
  episodeId: string;
  episodeNumber: number;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 502) {
    super(message);
  }
}
