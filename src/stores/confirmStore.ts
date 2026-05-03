import { writable, type Writable } from 'svelte/store';

export type ConfirmRequest = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    resolve: (ok: boolean) => void;
};

export const confirmRequest: Writable<ConfirmRequest | null> = writable(null);

export function requestConfirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        confirmRequest.set({ ...opts, resolve });
    });
}
