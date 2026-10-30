import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, rm, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import type { Client } from 'openhongguo';
import { NextRequest } from 'next/server';
import { getPlaybackInfo, prepareMedia, selectStream } from '../src/lib/server/media';
import { GET as media } from '../src/app/api/media/[id]/route';

test('default stream selection prefers browser-compatible video and respects explicit quality', () => {
  const streams = [
    { url: 'https://example.test/high', definition: '1080p', codec: 'bytevc1', height: 1080, protected: false },
    { url: 'https://example.test/low', definition: '720p', codec: 'h264', height: 720, protected: false },
  ];
  assert.equal(selectStream(streams).definition, '720p');
  assert.equal(selectStream(streams, '1080p').definition, '1080p');
  assert.throws(() => selectStream(streams, '4K'));
});

test('CENC input is prepared as a seekable MP4 and served with correct byte ranges', { timeout: 30_000 }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pianke-media-test-'));
  const fixture = path.join(directory, 'encrypted.mp4');
  const key = '00112233445566778899aabbccddeeff';
  const id = '990000000000000001';
  let preparedFile = '';
  const state = globalThis as typeof globalThis & { piankeClient?: Promise<Client> };
  const previousClient = state.piankeClient;
  try {
    await promisify(execFile)(ffmpeg.path, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-encryption_scheme', 'cenc-aes-ctr', '-encryption_key', key, '-encryption_kid', '11111111111111111111111111111111', fixture]);
    state.piankeClient = Promise.resolve({ resolvePlayback: async () => ({ playback: { episode_id: id, protected: true, streams: [{ definition: 'test-90p', codec: 'h264', url: fixture, protected: true }] }, contentKey: { key } }) } as unknown as Client);
    const prepared = await prepareMedia(id);
    preparedFile = prepared.file;
    const bytes = await readFile(prepared.file);
    assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
    await promisify(execFile)(ffmpeg.path, ['-v', 'error', '-i', prepared.file, '-frames:v', '1', '-f', 'null', '-']);
    const cache = (globalThis as typeof globalThis & { piankeCache?: Map<string, unknown> }).piankeCache;
    cache?.delete(`playback:${id}`);
    state.piankeClient = Promise.resolve({ resolvePlayback: async () => { throw new Error('Upstream unavailable after successful preparation'); } } as unknown as Client);
    const info = await getPlaybackInfo(id, 'live');
    assert.equal(info.source, 'live');
    assert.ok(!JSON.stringify(info).includes(key));
    assert.ok(!JSON.stringify(info).includes(directory));
    const response = await media(new NextRequest(`http://localhost/api/media/${id}?quality=test-90p`, { headers: { Range: 'bytes=4-7' } }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 4-7/${bytes.length}`);
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'ftyp');
    const invalid = await media(new NextRequest(`http://localhost/api/media/${id}?quality=test-90p`, { headers: { Range: `bytes=${bytes.length}-` } }), { params: Promise.resolve({ id }) });
    assert.equal(invalid.status, 416);
  } finally {
    state.piankeClient = previousClient;
    if (preparedFile) await unlink(preparedFile).catch(() => {});
    const mediaDir = path.join(process.cwd(), '.cache', 'media');
    for (const name of await readdir(mediaDir)) if (name.startsWith(id)) await unlink(path.join(mediaDir, name)).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
