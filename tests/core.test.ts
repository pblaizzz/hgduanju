import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, formatTime } from '../src/lib/media-utils';
import { demoCatalog, demoDetail, demoDramas, validDemoEpisode } from '../src/lib/demo';
import { parseLibrary, updateHistory } from '../src/lib/library';
import { resumeEpisode } from '../src/lib/resume';
import type { WatchRecord } from '../src/lib/types';

test('byte ranges support seeking, open ranges and suffix ranges', () => {
  assert.deepEqual(parseRange('bytes=20-49', 100), { start: 20, end: 49 });
  assert.deepEqual(parseRange('bytes=20-', 100), { start: 20, end: 99 });
  assert.deepEqual(parseRange('bytes=-20', 100), { start: 80, end: 99 });
  assert.deepEqual(parseRange('bytes=20-999', 100), { start: 20, end: 99 });
  assert.equal(parseRange(null, 100), null);
});

test('invalid and multipart ranges are rejected', () => {
  for (const header of ['bytes=100-', 'bytes=50-20', 'bytes=-0', 'bytes=-', 'bytes=0-2,4-6', 'items=0-9', 'bytes=9007199254740992-']) {
    assert.equal(parseRange(header, 100), 'invalid', header);
  }
});

test('time display handles unavailable metadata', () => {
  assert.equal(formatTime(NaN), '00:00');
  assert.equal(formatTime(-10), '00:00');
  assert.equal(formatTime(125.8), '02:05');
});

test('demo search matches titles and genres; content filters are real filters', () => {
  assert.equal(demoCatalog('月色').items[0].id, 'demo-moon');
  assert.ok(demoCatalog('治愈').items.length >= 2);
  assert.deepEqual(demoCatalog('', 'comic').items.map((item) => item.id), ['demo-forest']);
  assert.equal(demoCatalog('不存在的故事').items.length, 0);
});

test('demo episode IDs are validated against actual episode counts', () => {
  assert.ok(validDemoEpisode('demo-moon-ep-12'));
  assert.ok(!validDemoEpisode('demo-moon-ep-13'));
  assert.ok(!validDemoEpisode('demo-moon-ep-0'));
  assert.throws(() => demoDetail('does-not-exist'));
});

const baseRecord: WatchRecord = {
  drama: demoDramas[0], episodeId: 'demo-moon-ep-2', episodeNumber: 2,
  position: 12, duration: 32, completed: false, updatedAt: 100,
};

test('history updates one record per drama without mixing sources', () => {
  const live = { ...baseRecord, drama: { ...baseRecord.drama, source: 'live' as const } };
  const newer = { ...baseRecord, position: 20, updatedAt: 200 };
  const result = updateHistory([baseRecord, live], newer);
  assert.equal(result.length, 2);
  assert.equal(result[0].position, 20);
  assert.equal(result[1].drama.source, 'live');
});

test('corrupt or partially invalid browser storage does not break the app', () => {
  assert.deepEqual(parseLibrary('not json'), { favorites: [], history: [] });
  const value = parseLibrary(JSON.stringify({ favorites: [null, demoDramas[0]], history: [null, { ...baseRecord, position: -1 }, baseRecord] }));
  assert.equal(value.favorites.length, 1);
  assert.equal(value.history.length, 1);
});

test('resume continues unfinished episodes and moves on after completion', () => {
  const { episodes } = demoDetail('demo-moon');
  assert.equal(resumeEpisode(episodes, baseRecord)?.number, 2);
  assert.equal(resumeEpisode(episodes, { ...baseRecord, completed: true })?.number, 3);
  const withLock = episodes.map((episode) => ({ ...episode, playable: episode.number !== 3 }));
  assert.equal(resumeEpisode(withLock, { ...baseRecord, completed: true })?.number, 2);
  assert.equal(resumeEpisode(episodes, { ...baseRecord, episodeId: 'missing' })?.number, 1);
});
