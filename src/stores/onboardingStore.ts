import { writable } from "svelte/store";
import { openDB, STORE_NAMES } from "./idbStore";

const KEY = "onboardingDismissed";

// Gates rendering until the IDB read resolves, so returning users never flash the card.
export const onboardingReady = writable<boolean>(false);
export const onboardingDismissed = writable<boolean>(false);

openDB()
    .then(db => new Promise<unknown>((res, rej) => {
        const req = db.transaction(STORE_NAMES.PREF, "readonly").objectStore(STORE_NAMES.PREF).get(KEY);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
    }))
    .then(v => { onboardingDismissed.set(!!v); onboardingReady.set(true); })
    .catch(() => { onboardingReady.set(true); });

export function dismissOnboarding(): void {
    onboardingDismissed.set(true);
    openDB().then(db => {
        const tx = db.transaction(STORE_NAMES.PREF, "readwrite");
        tx.objectStore(STORE_NAMES.PREF).put(true, KEY);
    }).catch(() => {});
}
