const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.round((ts - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function preview(content: string): string {
  const line = content.split('\n').find((l) => l.trim());
  return line ? line.trim().slice(0, 140) : '';
}
