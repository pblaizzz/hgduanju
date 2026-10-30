import type { Episode, WatchRecord } from './types';

export function resumeEpisode(episodes: Episode[], record?: WatchRecord): Episode | undefined {
  if (record) {
    const index = episodes.findIndex((episode) => episode.id === record.episodeId);
    if (index >= 0) {
      if (record.completed && episodes[index + 1]?.playable) return episodes[index + 1];
      if (episodes[index].playable) return episodes[index];
    }
  }
  return episodes.find((episode) => episode.playable);
}
