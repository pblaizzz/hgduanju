import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Transport } from 'openhongguo';

// Use the system trust store and network configuration. Keep compressed bytes intact:
// the Go SDK, rather than curl, handles Content-Encoding.
export const curlTransport: Transport = async (request) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pianke-http-'));
  const headerFile = path.join(directory, 'headers');
  try {
    const args = ['--silent', '--show-error', '--connect-timeout', '10', '--max-time', '20', '--max-filesize', '8388608', '--request', request.method, '--dump-header', headerFile, '--write-out', '%{http_code}'];
    for (const [key, value] of Object.entries(request.headers)) args.push('--header', `${key}: ${value}`);
    if (request.body?.length) args.push('--data-binary', '@-');
    args.push(request.url);
    const output = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      let size = 0;
      const timeout = setTimeout(() => child.kill('SIGKILL'), 22_000);
      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024 + 3) child.kill('SIGKILL');
        else chunks.push(chunk);
      });
      child.stdin.on('error', () => {});
      child.once('error', (error) => { clearTimeout(timeout); reject(error); });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`curl transport failed (${code})`));
      });
      child.stdin.end(request.body?.length ? Buffer.from(request.body) : undefined);
    });
    const status = Number(output.subarray(-3).toString());
    if (status < 100 || status > 599) throw new Error('invalid HTTP response');
    const raw = (await readFile(headerFile, 'utf8')).trim().split(/\r?\n\r?\n/).at(-1)!;
    const headers: Record<string, string> = {};
    const cookies: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/).slice(1)) {
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const key = line.slice(0, separator).toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === 'set-cookie') {
        const [pair] = value.split(';');
        const equals = pair.indexOf('=');
        if (equals > 0) cookies[pair.slice(0, equals).trim()] = pair.slice(equals + 1).trim();
      } else headers[key] = value;
    }
    return { status, headers, cookies, body: new Uint8Array(output.subarray(0, -3)) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
