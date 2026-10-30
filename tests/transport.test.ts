import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import type { AddressInfo } from 'node:net';
import type { Client } from 'openhongguo';
import { NextRequest } from 'next/server';
import { curlTransport } from '../src/lib/server/transport';
import { GET as cover } from '../src/app/api/cover/[id]/route';

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('curl transport preserves compressed bytes, cookies and HTTP error responses', async () => {
  const body = gzipSync('raw compressed SDK response');
  const server = createServer((request, response) => {
    response.statusCode = request.url === '/limited' ? 429 : 200;
    response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Set-Cookie', ['guest=x==; Path=/; HttpOnly', 'session=y; Path=/']);
    response.end(body);
  });
  try {
    const origin = await listen(server);
    for (const route of ['', '/limited']) {
      const result = await curlTransport({ method: 'GET', url: origin + route, headers: {}, body: new Uint8Array() });
      assert.deepEqual(Buffer.from(result.body), body);
      assert.equal(result.cookies?.guest, 'x==');
      assert.equal(result.cookies?.session, 'y');
      assert.equal(result.status, route ? 429 : 200);
    }
  } finally { server.close(); }
});

test('HEIC covers are served to browsers as JPEGs', { timeout: 15_000 }, async () => {
  const fixture = await readFile(new URL('./fixtures/square.heic', import.meta.url));
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'image/heic');
    response.end(fixture);
  });
  const state = globalThis as typeof globalThis & { piankeClient?: Promise<Client> };
  const previous = state.piankeClient;
  const id = '990000000000000002';
  try {
    const origin = await listen(server);
    state.piankeClient = Promise.resolve({ getSeriesBatch: async () => [{ series: { id, title: 'Test cover', cover_url: origin + '/cover.heic' }, episodes: [] }] } as unknown as Client);
    const result = await cover(new NextRequest(`http://localhost/api/cover/${id}`), { params: Promise.resolve({ id }) });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await result.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    assert.equal(bytes.subarray(-2).toString('hex'), 'ffd9');
  } finally {
    state.piankeClient = previous;
    server.close();
  }
});
