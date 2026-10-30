import { NextResponse } from 'next/server';
import { AppError, type ContentKind, type Source } from '../types';

export function readSource(params: URLSearchParams): Source {
  const source = params.get('source') || 'live';
  if (source !== 'live' && source !== 'demo') throw new AppError('INVALID_OPTIONS', '片单来源无效。', 400);
  return source;
}

export function readKind(params: URLSearchParams): ContentKind {
  const kind = params.get('kind') || 'all';
  if (!['all', 'human', 'comic', 'ai', 'film'].includes(kind)) throw new AppError('INVALID_OPTIONS', '内容类型无效。', 400);
  return kind as ContentKind;
}

const messages: Record<string, string> = {
  AUTHENTICATION_REQUIRED: '这一集需要在官方平台登录后观看。',
  CONTENT_UNAVAILABLE: '内容已下架，或当前匿名设备无法访问。',
  ANONYMOUS_LIMITED: '当前匿名设备没有获取到内容，请稍后再试。',
  RATE_LIMITED: '请求有些频繁，请稍后再试。',
  CHALLENGE_REQUIRED: '上游需要额外验证，当前暂时无法访问。',
  DEVICE_REJECTED: '当前匿名设备已被上游拒绝，暂时无法访问。',
  SIGNATURE_REJECTED: '上游接口暂时不可用，请稍后再试。',
  TRANSPORT: '暂时无法连接片源服务，请检查网络或体验样片。',
  DRM_PROTECTED: '这一集暂时无法准备播放，请换一集试试。',
};

export function apiError(error: unknown): NextResponse {
  const known = error as { code?: string; message?: string; retryAfterMs?: number };
  const code = known.code || 'UNKNOWN';
  const message = error instanceof AppError ? error.message : messages[code] || '片源服务暂时没有响应，请稍后重试。';
  const status = error instanceof AppError ? error.status : code === 'RATE_LIMITED' ? 429 : 502;
  return NextResponse.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(known.retryAfterMs ? { 'Retry-After': String(Math.ceil(known.retryAfterMs / 1000)) } : {}) },
  });
}
