import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import type { PlaybackResult, Stream } from 'openhongguo';
import { validDemoEpisode } from '../demo';
import { AppError, type PlaybackInfo, type Source } from '../types';
import { assertLiveId, cached, getClient } from './catalog';

const cacheDir = path.join(process.cwd(), '.cache', 'media');
const state = globalThis as typeof globalThis & { piankeJobs?: Map<string, Promise<string>> };
const MAX_AGE = 30 * 60_000;
type PreparedMedia = { file: string; quality: string; qualities: string[] };

function manifestPath(id: string, quality: string): string {
  const variant = createHash('sha256').update(quality).digest('hex').slice(0, 16);
  return path.join(cacheDir, `${id}-${variant}.json`);
}

async function readPrepared(id: string, quality: string): Promise<PreparedMedia | null> {
  try {
    const value = JSON.parse(await readFile(manifestPath(id, quality), 'utf8'));
    if (!/^[a-f0-9]{64}\.mp4$/.test(value.filename) || typeof value.quality !== 'string' || !Array.isArray(value.qualities)) return null;
    const file = path.join(cacheDir, value.filename);
    const info = await stat(file);
    if (info.size > 0 && Date.now() - info.mtimeMs < MAX_AGE) return { file, quality: value.quality, qualities: value.qualities };
  } catch { /* Missing, expired or incomplete cache entries are rebuilt. */ }
  return null;
}

async function rememberPrepared(id: string, requestedQuality: string, value: PreparedMedia): Promise<PreparedMedia> {
  const json = JSON.stringify({ filename: path.basename(value.file), quality: value.quality, qualities: value.qualities });
  await Promise.all([...new Set([requestedQuality, value.quality])].map((quality) => writeFile(manifestPath(id, quality), json)));
  return value;
}

async function playbackModel(id: string): Promise<PlaybackResult> {
  assertLiveId(id);
  return cached(`playback:${id}`, async () => (await getClient()).resolvePlayback(id), 20_000);
}

export function selectStream(streams: Stream[], quality = ''): Stream {
  const available = streams.filter((stream) => stream.url);
  const matching = quality ? available.filter((stream) => (stream.definition || stream.quality || '原画') === quality) : available;
  if (!matching.length) throw new AppError('CONTENT_UNAVAILABLE', '这一集没有可用的清晰度。', 404);
  return [...matching].sort((a, b) => {
    // Prefer an AVC stream for browser compatibility when quality is not explicitly selected.
    const avc = (stream: Stream) => /^(h264|avc|avc1)$/i.test(stream.codec || '') ? 1 : 0;
    return avc(b) - avc(a) || (b.height || 0) - (a.height || 0) || (b.bitrate || 0) - (a.bitrate || 0);
  })[0];
}

async function cleanCache(): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const names = await readdir(cacheDir);
  await Promise.all(names.filter((name) => /\.(mp4|json)$/.test(name)).map(async (name) => {
    const file = path.join(cacheDir, name);
    try { if (Date.now() - (await stat(file)).mtimeMs > MAX_AGE) await unlink(file); } catch { /* Another request may already have removed this file. */ }
  }));
}

function remux(args: string[], target: string): Promise<void> {
  const executable = process.env.FFMPEG_PATH || ffmpeg.path;
  if (!executable) throw new AppError('MEDIA_UNAVAILABLE', '播放组件未安装，请配置 FFmpeg。', 503);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args, '-movflags', '+faststart', '-f', 'mp4', target], { stdio: 'ignore' });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 150_000);
    child.once('error', () => { clearTimeout(timeout); reject(new AppError('MEDIA_UNAVAILABLE', '播放组件启动失败，请检查 FFmpeg 配置。', 503)); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new AppError('MEDIA_FAILED', '视频准备失败，请重试或选择其他清晰度。'));
    });
  });
}

export async function prepareMedia(id: string, quality = ''): Promise<PreparedMedia> {
  assertLiveId(id);
  const remembered = await readPrepared(id, quality);
  if (remembered) return remembered;
  const result = await playbackModel(id);
  const pb = result.playback;
  const stream = selectStream(pb.streams, quality);
  const selectedQuality = stream.definition || stream.quality || '原画';
  const qualities = [...new Set(pb.streams.filter((item) => item.url).map((item) => item.definition || item.quality || '原画'))];
  const key = result.contentKey?.key;
  if ((pb.protected || stream.protected) && !key) throw new AppError('DRM_PROTECTED', '这一集暂时无法准备播放，请选择其他分集。');
  const cacheKey = createHash('sha256').update(`${id}:${selectedQuality}:${stream.codec}`).digest('hex');
  const file = path.join(cacheDir, `${cacheKey}.mp4`);
  try {
    const info = await stat(file);
    if (info.size > 0 && Date.now() - info.mtimeMs < MAX_AGE) return rememberPrepared(id, quality, { file, quality: selectedQuality, qualities });
  } catch { /* The first request prepares the media. */ }
  const jobs = state.piankeJobs ??= new Map();
  let job = jobs.get(cacheKey);
  if (!job) {
    if (jobs.size >= 2) throw new AppError('MEDIA_BUSY', '正在准备其他视频，请稍后再试。', 429);
    job = (async () => {
      await cleanCache();
      const temp = path.join(cacheDir, `${cacheKey}.part.mp4`);
      const makeArgs = (url: string) => {
        const input = (value: string) => ['-rw_timeout', '20000000', ...(key ? ['-decryption_key', key] : []), '-i', value];
        return [
          ...input(url), ...(pb.audio_url ? input(pb.audio_url) : []),
          '-map', '0:v:0', '-map', pb.audio_url ? '1:a:0' : '0:a:0?',
          ...(/^(h264|avc|avc1)$/i.test(stream.codec || '')
            ? ['-c:v', 'copy']
            : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p']),
          '-c:a', 'aac', '-ac', '2', '-b:a', '128k',
        ];
      };
      try {
        try { await remux(makeArgs(stream.url!), temp); }
        catch (error) {
          if (!stream.backup_url || (error as AppError).code === 'MEDIA_UNAVAILABLE') throw error;
          await remux(makeArgs(stream.backup_url), temp);
        }
        await rename(temp, file);
        return file;
      } finally {
        await unlink(temp).catch(() => {});
      }
    })().finally(() => jobs.delete(cacheKey));
    jobs.set(cacheKey, job);
  }
  await job;
  return rememberPrepared(id, quality, { file, quality: selectedQuality, qualities });
}

export async function getPlaybackInfo(id: string, source: Source, quality = ''): Promise<PlaybackInfo> {
  if (source === 'demo') {
    if (!validDemoEpisode(id)) throw new AppError('CONTENT_UNAVAILABLE', '没有找到这个体验分集。', 404);
    return { src: '/sample/trailer.mp4', quality: '480p', qualities: ['480p'], source };
  }
  const prepared = await prepareMedia(id, quality);
  return {
    src: `/api/media/${id}?quality=${encodeURIComponent(prepared.quality)}`,
    quality: prepared.quality, qualities: prepared.qualities, source,
  };
}
