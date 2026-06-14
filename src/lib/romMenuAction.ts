import type { LibraryRom } from "../types";
import { openRomMenu } from "stores/romMenuStore";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

// Svelte action: wires right-click + touch long-press on a card to the ROM context
// menu. Suppresses the synthetic click that would otherwise fire after a long-press
// (which would start playing the ROM) via a one-shot capture-phase blocker.
export function romMenuTrigger(node: HTMLElement, rom: LibraryRom) {
    let current = rom;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    function clear() {
        if (timer) { clearTimeout(timer); timer = null; }
    }

    function suppressNextClick() {
        const block = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
            node.removeEventListener("click", block, true);
        };
        node.addEventListener("click", block, true);
    }

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
        openRomMenu(current, e.clientX, e.clientY);
    }

    function onTouchStart(e: TouchEvent) {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        clear();
        timer = setTimeout(() => {
            timer = null;
            suppressNextClick();
            openRomMenu(current, startX, startY);
        }, LONG_PRESS_MS);
    }
    function onTouchMove(e: TouchEvent) {
        const t = e.touches[0];
        if (!t) return;
        if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) clear();
    }

    node.addEventListener("contextmenu", onContextMenu);
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", clear);
    node.addEventListener("touchcancel", clear);

    return {
        update(next: LibraryRom) { current = next; },
        destroy() {
            clear();
            node.removeEventListener("contextmenu", onContextMenu);
            node.removeEventListener("touchstart", onTouchStart);
            node.removeEventListener("touchmove", onTouchMove);
            node.removeEventListener("touchend", clear);
            node.removeEventListener("touchcancel", clear);
        },
    };
}
