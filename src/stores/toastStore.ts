import { writable, type Writable } from 'svelte/store';

export type ToastKind = 'info' | 'error' | 'success';
export type Toast = {
    id: number;
    kind: ToastKind;
    message: string;
    durationMs: number;
};

export const toasts: Writable<Toast[]> = writable([]);
let nextId = 1;

export function showToast(message: string, kind: ToastKind = 'info', durationMs: number = 3500): void {
    const id = nextId++;
    const toast: Toast = { id, kind, message, durationMs };
    toasts.update(list => [...list, toast]);
    setTimeout(() => {
        toasts.update(list => list.filter(t => t.id !== id));
    }, durationMs);
}

export function dismissToast(id: number): void {
    toasts.update(list => list.filter(t => t.id !== id));
}
