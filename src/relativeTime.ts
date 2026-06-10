const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' });

export function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'Just now';
    const m = Math.floor(diff / 60_000);
    if (m < 60) return rtf.format(-m, 'minute');
    const h = Math.floor(m / 60);
    if (h < 24) return rtf.format(-h, 'hour');
    const d = Math.floor(h / 24);
    if (d < 7) return rtf.format(-d, 'day');
    return new Date(ts).toLocaleDateString();
}
