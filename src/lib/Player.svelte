<script lang="ts">
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import { showFrametimeHistogram, WakeLockEnabled, OrientationLockEnabled } from "stores/optionsStore";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { AudioSuspended, Emulator } from "../emulator";
    import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";
    import RomDropZone from "./RomDropZone.svelte";
    import OnboardingCard from "./OnboardingCard.svelte";
    import GameStage from "./GameStage.svelte";
    import { DragState } from "../types";
    import {
        drawerOpen,
        revealChrome, hideChrome, closeDrawer, registerFullscreenToggle,
    } from "stores/playUiStore";

    let dragState: DragState = $state(DragState.Idle);
    let rootEl: HTMLDivElement | undefined = $state();
    let screenTapEl: HTMLDivElement | undefined = $state();
    let flyTargetEl: HTMLDivElement | undefined = $state();
    let isFullscreen: boolean = $state(false);
    let isCoarsePointer: boolean = $state(false);
    let isLandscape: boolean = $state(false);

    const hasRom = $derived($loadedCartridge != undefined || $loadedBootRom != undefined);

    // Drawer open -> shrink the stage to a ~1/3 strip beside the full-surface drawer.
    // With a coarse pointer the strip flips to the opposite orientation (mini-console,
    // pad visible for live preview); desktop just shrinks the screen (P9 deferred).
    const flip = $derived($drawerOpen);
    const stageSize = $derived<"full" | "mini">($drawerOpen ? "mini" : "full");
    const stageLayout = $derived<"portrait" | "landscape">(
        $drawerOpen && isCoarsePointer
            ? (isLandscape ? "portrait" : "landscape")
            : (isLandscape ? "landscape" : "portrait"),
    );

    function toggleFullscreen() {
        if (!document.fullscreenElement) rootEl?.requestFullscreen();
        else document.exitFullscreen();
    }

    onMount(() => {
        registerFullscreenToggle(toggleFullscreen);

        const onFullscreenChange = () => { isFullscreen = !!document.fullscreenElement; };
        document.addEventListener("fullscreenchange", onFullscreenChange);

        const coarseMql = window.matchMedia("(pointer: coarse)");
        const updateCoarse = () => { isCoarsePointer = coarseMql.matches; };
        updateCoarse();
        coarseMql.addEventListener("change", updateCoarse);

        const landscapeMql = window.matchMedia("(orientation: landscape)");
        const updateLandscape = () => { isLandscape = landscapeMql.matches; };
        updateLandscape();
        landscapeMql.addEventListener("change", updateLandscape);

        // Desktop: Esc reveals chrome (closes drawer first if open).
        const onEsc = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || isCoarsePointer) return;
            if (get(drawerOpen)) { e.preventDefault(); closeDrawer(); return; }
            if (!hasRom) return;
            e.preventDefault();
            revealChrome();
        };
        window.addEventListener("keydown", onEsc);

        // Chrome reveals on cursor activity (desktop, fine pointer).
        const onMove = () => { if (!isCoarsePointer) revealChrome(); };
        window.addEventListener("pointermove", onMove);
        revealChrome();

        return () => {
            registerFullscreenToggle(null);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            coarseMql.removeEventListener("change", updateCoarse);
            landscapeMql.removeEventListener("change", updateLandscape);
            window.removeEventListener("keydown", onEsc);
            window.removeEventListener("pointermove", onMove);
        };
    });

    $effect(() => {
        if ($drawerOpen) return;
        window.addEventListener("keydown", gameInputKeydownHandler);
        window.addEventListener("keyup", gameInputKeyupHandler);
        return () => {
            window.removeEventListener("keydown", gameInputKeydownHandler);
            window.removeEventListener("keyup", gameInputKeyupHandler);
        };
    });

    let wakeLock: WakeLockSentinel | null = null;
    async function acquireWakeLock() {
        if (wakeLock) return;
        if (!("wakeLock" in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request("screen");
            wakeLock.addEventListener("release", () => { wakeLock = null; });
        } catch (_) { /* permission/denial: ignore */ }
    }
    async function releaseWakeLock() {
        if (!wakeLock) return;
        try { await wakeLock.release(); } catch (_) { /* ignore */ }
        wakeLock = null;
    }

    $effect(() => {
        if (!hasRom || !$WakeLockEnabled) {
            releaseWakeLock();
            return;
        }
        acquireWakeLock();
        const onVis = () => { if (document.visibilityState === "visible") acquireWakeLock(); };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            document.removeEventListener("visibilitychange", onVis);
            releaseWakeLock();
        };
    });

    $effect(() => {
        if (!isFullscreen || !isCoarsePointer || !$OrientationLockEnabled) return;
        const so = (screen as any).orientation;
        if (!so?.lock) return;
        so.lock("landscape").catch(() => { /* ignore */ });
        return () => { so.unlock?.(); };
    });

    $effect(() => {
        const data = $QuickSaveFlyer;
        if (!data || !screenTapEl || !flyTargetEl) return;
        const from = screenTapEl.getBoundingClientRect();
        const to = flyTargetEl.getBoundingClientRect();
        const targetSize = 16;
        const targetLeft = to.left + to.width / 2 - targetSize / 2;
        const targetTop = to.top + to.height / 2 - targetSize / 2;
        const dx = from.left - targetLeft;
        const dy = from.top - targetTop;
        const sx = from.width / targetSize;
        const sy = from.height / targetSize;
        const img = document.createElement("img");
        img.src = data.thumbnail;
        img.style.cssText = `position:fixed;pointer-events:none;z-index:1000;image-rendering:pixelated;border-radius:2px;box-shadow:0 0 12px rgba(0,0,0,0.7);transform-origin:top left;`;
        img.style.left = targetLeft + "px";
        img.style.top = targetTop + "px";
        img.style.width = targetSize + "px";
        img.style.height = targetSize + "px";
        document.body.appendChild(img);
        const anim = img.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
                { transform: "none", opacity: 0 },
            ],
            { duration: 650, easing: "cubic-bezier(0.4, 0.7, 0.5, 1)", fill: "forwards" }
        );
        anim.onfinish = () => img.remove();
        anim.oncancel = () => img.remove();
    });
</script>

<div
    class="play-shell"
    class:flip
    class:landscape={isLandscape}
    role="main"
>
    <div class="fly-anchor" bind:this={flyTargetEl} aria-hidden="true"></div>

    <OnboardingCard />

    <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState>
        <div
            class="stage-wrap"
            class:drop-allowed={dragState == DragState.Accept}
            class:drop-disallowed={dragState == DragState.Reject}
            bind:this={rootEl}
        >
            <GameStage
                layout={stageLayout}
                size={stageSize}
                interactive={true}
                showPad={isCoarsePointer}
                minimalChrome={flip}
                {hasRom}
                coarse={isCoarsePointer}
                onRequestFullscreen={toggleFullscreen}
                registerScreenEl={(el) => (screenTapEl = el)}
            />
            {#if $showFrametimeHistogram}
                <div class="frametime-wrapper">
                    <FrametimeHistogram />
                </div>
            {/if}
            {#if $AudioSuspended && !$EmulatorPaused}
                <button class="audio-hint" onclick={() => {}} aria-label="Enable audio">
                    🔇 Click to enable sound
                </button>
            {/if}
        </div>
    </RomDropZone>
</div>

<style>
    .play-shell {
        position: relative;
        min-height: 100dvh;
        height: 100dvh;
        background: var(--page-bg, #0a0a12);
        color: var(--text-color, #cdd6f4);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .play-shell:focus,
    .play-shell:focus-within { outline: none; }

    .fly-anchor {
        position: absolute;
        top: 0.6em;
        left: 0.6em;
        width: 1px;
        height: 1px;
        pointer-events: none;
    }

    /* Absolute-fill so the stage has a concrete box regardless of the (style-less,
       flow-collapsing) RomDropZone wrapper — GameStage's container queries (cqh/cqw)
       need a real size to resolve against. */
    .stage-wrap {
        position: absolute;
        inset: 0;
        display: flex;
        transition: top 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out;
    }

    /* Drawer-open flip: stage collapses to a ~1/3 strip; the full-surface drawer
       (fixed, opaque) fills the rest. Single canvas reflows — snap, no morph (T2/T3). */
    .play-shell.flip:not(.landscape) .stage-wrap {
        height: 34dvh;
    }
    .play-shell.flip.landscape .stage-wrap {
        left: auto;
        width: 34vw;
    }
    @media (prefers-reduced-motion: reduce) {
        .stage-wrap { transition: none; }
    }

    .stage-wrap.drop-allowed { background-color: rgba(96, 140, 184, 0.25); }
    .stage-wrap.drop-disallowed { background-color: rgba(122, 107, 104, 0.25); }

    .stage-wrap:fullscreen {
        padding: 0;
        background: #000;
        width: 100vw;
        height: 100dvh;
    }

    .frametime-wrapper {
        position: absolute;
        top: 0.05cqmin;
        left: 0.05cqmin;
        z-index: 5;
        pointer-events: none;
    }

    .audio-hint {
        position: absolute;
        bottom: 0.6em;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.75);
        border: none;
        color: #fff;
        font-size: 0.85em;
        cursor: pointer;
        border-radius: 0.4em;
        padding: 0.3em 0.7em;
        white-space: nowrap;
        z-index: 10;
    }
    .audio-hint:hover { background: rgba(0, 0, 0, 0.9); }
</style>
