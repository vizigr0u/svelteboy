import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-06-10T12:00:00Z').getTime();
const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'long' });

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('formatRelativeTime', () => {
    it('returns "Just now" for 0s ago', () => {
        expect(formatRelativeTime(NOW)).toBe('Just now');
    });

    it('returns "Just now" for 59s ago', () => {
        expect(formatRelativeTime(NOW - 59_000)).toBe('Just now');
    });

    it('switches to minutes at exactly 60s', () => {
        expect(formatRelativeTime(NOW - 60_000)).toBe(rtf.format(-1, 'minute'));
    });

    it('formats minute range via Intl', () => {
        expect(formatRelativeTime(NOW - 5 * 60_000)).toBe(rtf.format(-5, 'minute'));
        expect(formatRelativeTime(NOW - 59 * 60_000)).toBe(rtf.format(-59, 'minute'));
    });

    it('switches to hours at 60min', () => {
        expect(formatRelativeTime(NOW - 60 * 60_000)).toBe(rtf.format(-1, 'hour'));
    });

    it('formats hour range via Intl', () => {
        expect(formatRelativeTime(NOW - 5 * 3_600_000)).toBe(rtf.format(-5, 'hour'));
        expect(formatRelativeTime(NOW - 23 * 3_600_000)).toBe(rtf.format(-23, 'hour'));
    });

    it('switches to days at 24h', () => {
        expect(formatRelativeTime(NOW - 24 * 3_600_000)).toBe(rtf.format(-1, 'day'));
    });

    it('formats day range via Intl', () => {
        expect(formatRelativeTime(NOW - 6 * 86_400_000)).toBe(rtf.format(-6, 'day'));
    });

    it('returns absolute date at 7d boundary', () => {
        const t = NOW - 7 * 86_400_000;
        expect(formatRelativeTime(t)).toBe(new Date(t).toLocaleDateString());
    });

    it('returns absolute date for 30 days ago', () => {
        const t = NOW - 30 * 86_400_000;
        expect(formatRelativeTime(t)).toBe(new Date(t).toLocaleDateString());
    });

    it('numeric:auto produces "yesterday"-style label at 1 day', () => {
        // Locale-dependent string, but assert it differs from numeric:always.
        const auto = rtf.format(-1, 'day');
        const always = new Intl.RelativeTimeFormat(undefined, { numeric: 'always', style: 'long' }).format(-1, 'day');
        expect(formatRelativeTime(NOW - 24 * 3_600_000)).toBe(auto);
        // Sanity: numeric:auto should differ from numeric:always for -1 day in en locales.
        if (Intl.RelativeTimeFormat.supportedLocalesOf(['en-US']).length > 0) {
            expect(auto).not.toBe(always);
        }
    });
});
