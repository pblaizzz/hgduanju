import { AppError, type Catalog, type ContentKind, type Drama, type DramaDetail } from './types';

// Fictional titles for interface previews. Playback is explicitly labelled as a Blender sample.
export const demoDramas: Drama[] = [
  { id: 'demo-moon', title: '月色恰好', description: '离开喧嚣的城市，她回到海边的旧书店。一封没有寄出的信，让两个错过的人，在这个秋天重新相遇。', cover: '/posters/moon.jpg', backdrop: '/posters/coast.jpg', episodeCount: 12, tags: ['都市', '爱情', '治愈'], status: '全12集', kind: 'human', source: 'demo' },
  { id: 'demo-city', title: '夜行来信', description: '每到午夜，一封来自陌生人的信就会出现在门口。城市的另一面，藏着一个等待被发现的秘密。', cover: '/posters/city.jpg', episodeCount: 8, tags: ['悬疑', '都市'], status: '全8集', kind: 'human', source: 'demo' },
  { id: 'demo-mountain', title: '山海之间', description: '一段没有计划的旅程，一间山里的小屋。那些找不到答案的问题，终于在远方慢慢清晰。', cover: '/posters/mountain.jpg', episodeCount: 10, tags: ['成长', '治愈'], status: '全10集', kind: 'human', source: 'demo' },
  { id: 'demo-rain', title: '雨停之前', description: '在雨季的小城重逢，曾经熟悉的两个人，开始重新认识彼此。', cover: '/posters/rain.jpg', episodeCount: 16, tags: ['爱情', '都市'], status: '全16集', kind: 'human', source: 'demo' },
  { id: 'demo-forest', title: '森林来客', description: '失落地图指向森林深处，一场关于勇气与友情的冒险就此开始。', cover: '/posters/forest.jpg', episodeCount: 6, tags: ['奇幻', '冒险'], status: '全6集', kind: 'comic', source: 'demo' },
  { id: 'demo-desert', title: '荒野回声', description: '穿过漫长的荒野，他追寻失去联系的朋友，也找回了那个曾经的自己。', cover: '/posters/desert.jpg', episodeCount: 9, tags: ['冒险', '成长'], status: '全9集', kind: 'human', source: 'demo' },
  { id: 'demo-star', title: '星际漫游', description: '一艘小小的飞船，一张无限的星图。在陌生星球上，遇见熟悉的人类情感。', cover: '/posters/star.jpg', episodeCount: 5, tags: ['科幻', '奇幻'], status: '全5集', kind: 'ai', source: 'demo' },
  { id: 'demo-sea', title: '去有风的海边', description: '把生活放慢一点，沿着海岸出发。一部关于日常、风景和重新开始的体验短片。', cover: '/posters/sea.jpg', episodeCount: 1, tags: ['旅行', '生活'], status: '短片', kind: 'film', source: 'demo' },
];

export function demoCatalog(query = '', kind: ContentKind = 'all', ranked = false): Catalog {
  const items = demoDramas.filter((drama) =>
    (kind === 'all' || drama.kind === kind) &&
    `${drama.title}${drama.description}${drama.tags.join('')}`.includes(query.trim()),
  );
  return { items: ranked ? [...items].reverse() : items, hasMore: false, source: 'demo' };
}

export function demoDetail(id: string): DramaDetail {
  const drama = demoDramas.find((item) => item.id === id);
  if (!drama) throw new AppError('CONTENT_UNAVAILABLE', '没有找到这部体验剧集。', 404);
  return {
    drama,
    episodes: Array.from({ length: drama.episodeCount }, (_, i) => ({
      id: `${id}-ep-${i + 1}`, number: i + 1, title: `第 ${i + 1} 集`, playable: true, vertical: false,
    })),
    source: 'demo',
  };
}

export function validDemoEpisode(id: string): boolean {
  const match = /^(demo-[a-z]+)-ep-(\d+)$/.exec(id);
  if (!match) return false;
  const drama = demoDramas.find((item) => item.id === match[1]);
  return !!drama && Number(match[2]) >= 1 && Number(match[2]) <= drama.episodeCount;
}
