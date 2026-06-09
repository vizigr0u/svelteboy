// In-memory cache of the active battery-save bank id per ROM sha1.
// Lets the run loop pick the target bank for autosaves without an async IDB read
// on every post-run cycle. Persistence still lives in IndexedDB via batterySaveDb.

const cache = new Map<string, string>();

export function setActiveBankCache(sha1: string, bankId: string): void {
    cache.set(sha1, bankId);
}

export function getActiveBankCache(sha1: string): string | undefined {
    return cache.get(sha1);
}

export function clearActiveBankCache(sha1: string): void {
    cache.delete(sha1);
}
