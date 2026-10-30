export interface ByteRange { start: number; end: number }

export function parseRange(header: string | null, size: number): ByteRange | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return 'invalid';
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start || start < 0) return 'invalid';
  return { start, end };
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
