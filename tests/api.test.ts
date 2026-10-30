import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as catalog } from '../src/app/api/catalog/route';
import { GET as playback } from '../src/app/api/playback/[id]/route';

const request = (query: string) => new NextRequest(`http://localhost/api/catalog?${query}`);

test('catalog, search and detail endpoints serve consistent demo data', async () => {
  const list = await (await catalog(request('source=demo'))).json();
  const result = await (await catalog(request('source=demo&view=search&q=月色'))).json();
  const detail = await (await catalog(request(`source=demo&view=detail&id=${result.items[0].id}`))).json();
  assert.equal(list.items.length, 8);
  assert.equal(result.items.length, 1);
  assert.equal(detail.episodes.length, detail.drama.episodeCount);
  assert.ok(detail.episodes.every((episode: { playable: boolean }) => episode.playable));
});

test('invalid source, kind, view and live IDs return client errors', async () => {
  for (const query of ['source=unknown', 'source=demo&kind=unknown', 'source=demo&view=unknown', 'view=detail&id=../../secrets']) {
    assert.equal((await catalog(request(query))).status, 400, query);
  }
});

test('missing demo titles and episodes are not silently replaced with other content', async () => {
  assert.equal((await catalog(request('source=demo&view=detail&id=demo-missing'))).status, 404);
  const response = await playback(new NextRequest('http://localhost/api/playback/demo-moon-ep-99?source=demo'), { params: Promise.resolve({ id: 'demo-moon-ep-99' }) });
  assert.equal(response.status, 404);
});

test('demo playback explicitly identifies its source and exposes no keys', async () => {
  const response = await playback(new NextRequest('http://localhost/api/playback/demo-moon-ep-1?source=demo'), { params: Promise.resolve({ id: 'demo-moon-ep-1' }) });
  const data = await response.json();
  assert.equal(data.source, 'demo');
  assert.equal(data.src, '/sample/trailer.mp4');
  assert.equal(data.contentKey, undefined);
});
