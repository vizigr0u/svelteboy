<script lang="ts">
    import FrametimeHistogram from "./debug/FrametimeHistogram.svelte";
    import {
        showFrametimeHistogram,
        SelectedPaletteIndex,
        PALETTE_PRESETS,
        CgbColor,
        GhostingStrength,
        PixelPerfect,
        WakeLockEnabled,
        OrientationLockEnabled,
    } from "stores/optionsStore";
    import HudOverlay from "./hud/HudOverlay.svelte";
    import LocalInputViewer from "./LocalInputViewer.svelte";
    import { gameInputKeydownHandler, gameInputKeyupHandler } from "../inputs";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { AudioSuspended, Emulator } from "../emulator";
    import { EmulatorPaused, QuickSaveFlyer } from "stores/playStores";
    import { loadedCartridge, loadedBootRom } from "stores/romStores";
    import RomDropZone from "./RomDropZone.svelte";
    import PlayRail from "./play/PlayRail.svelte";
    import OnboardingCard from "./OnboardingCard.svelte";
    import { DragState } from "../types";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import { registerShadedCanvas } from "../screenshot";
    import { selectedRomSha1 } from "stores/windowStores";
    import { overlayOpen, openOverlay, registerFullscreenToggle } from "stores/overlayStore";

    let dragState: DragState = $state(DragState.Idle);
    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let screenEl: HTMLDivElement | undefined = $state();
    let screenTapEl: HTMLDivElement | undefined = $state();
    let flyTargetEl: HTMLDivElement | undefined = $state();
    let isFullscreen: boolean = $state(false);
    let isCoarsePointer: boolean = $state(false);
    let titleVisible: boolean = $state(true);
    let titleTimer: ReturnType<typeof setTimeout> | null = null;

    function revealTitle() {
        titleVisible = true;
        if (titleTimer) clearTimeout(titleTimer);
        titleTimer = setTimeout(() => { titleVisible = false; titleTimer = null; }, 1500);
    }

    const DOUBLE_TAP_MS = 280;
    let lastTapTime = 0;
    let pendingTapTimer: ReturnType<typeof setTimeout> | null = null;

    function onScreenTap(e: MouseEvent) {
        // Desktop: rely on ondblclick for fullscreen, no sheet on single-click.
        if (!isCoarsePointer) return;
        if (!hasRom) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastTapTime < DOUBLE_TAP_MS) {
            // Double-tap → fullscreen, cancel pending sheet
            if (pendingTapTimer) { clearTimeout(pendingTapTimer); pendingTapTimer = null; }
            lastTapTime = 0;
            toggleFullscreen();
            return;
        }
        lastTapTime = now;
        if (pendingTapTimer) clearTimeout(pendingTapTimer);
        pendingTapTimer = setTimeout(() => {
            openOverlay('now');
            pendingTapTimer = null;
        }, DOUBLE_TAP_MS);
    }

    const hasRom = $derived($loadedCartridge != undefined || $loadedBootRom != undefined);

    function toggleFullscreen() {
        if (!document.fullscreenElement) screenEl?.requestFullscreen();
        else document.exitFullscreen();
    }

    onMount(() => {
        const drawCallback = () => {
            if (Emulator.IsCgbMode()) {
                webglCanvas?.draw(Emulator.GetCGBGameFrame());
            } else {
                webglCanvas?.draw(Emulator.GetGameFrame());
            }
        };
        Emulator.AddRenderCallback(drawCallback);
        registerShadedCanvas(() => webglCanvas?.getCanvas() ?? null);
        registerFullscreenToggle(toggleFullscreen);

        const onFullscreenChange = () => {
            isFullscreen = !!document.fullscreenElement;
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);

        const coarseMql = window.matchMedia('(pointer: coarse)');
        const updateCoarse = () => { isCoarsePointer = coarseMql.matches; };
        updateCoarse();
        coarseMql.addEventListener('change', updateCoarse);

        // Desktop: Esc opens the combo overlay (Overlay handles Esc-to-close itself).
        const onEsc = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || isCoarsePointer) return;
            if (get(overlayOpen) || !hasRom) return;
            e.preventDefault();
            openOverlay('now');
        };
        window.addEventListener('keydown', onEsc);

        // Title strip reveals on cursor activity (desktop).
        const onMove = () => { if (!isCoarsePointer) revealTitle(); };
        window.addEventListener('pointermove', onMove);
        revealTitle();

        return () => {
            Emulator.RemoveRenderCallback(drawCallback);
            registerShadedCanvas(null);
            registerFullscreenToggle(null);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            coarseMql.removeEventListener('change', updateCoarse);
            window.removeEventListener('keydown', onEsc);
            window.removeEventListener('pointermove', onMove);
            if (titleTimer) clearTimeout(titleTimer);
        };
    });

    const anyOverlayOpen = $derived(
        $overlayOpen
        || $selectedRomSha1 != undefined
    );

    // Reveal the title strip whenever the overlay closes.
    $effect(() => {
        if (!$overlayOpen) revealTitle();
    });

    $effect(() => {
        if (anyOverlayOpen) return;
        window.addEventListener('keydown', gameInputKeydownHandler);
        window.addEventListener('keyup', gameInputKeyupHandler);
        return () => {
            window.removeEventListener('keydown', gameInputKeydownHandler);
            window.removeEventListener('keyup', gameInputKeyupHandler);
        };
    });

    let wakeLock: WakeLockSentinel | null = null;

    async function acquireWakeLock() {
        if (wakeLock) return;
        if (!('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
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
        const onVis = () => { if (document.visibilityState === 'visible') acquireWakeLock(); };
        document.addEventListener('visibilitychange', onVis);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            releaseWakeLock();
        };
    });

    $effect(() => {
        if (!isFullscreen || !isCoarsePointer || !$OrientationLockEnabled) return;
        const so = (screen as any).orientation;
        if (!so?.lock) return;
        so.lock('landscape').catch(() => { /* ignore */ });
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
        const img = document.createElement('img');
        img.src = data.thumbnail;
        img.style.cssText = `position:fixed;pointer-events:none;z-index:1000;image-rendering:pixelated;border-radius:2px;box-shadow:0 0 12px rgba(0,0,0,0.7);transform-origin:top left;`;
        img.style.left = targetLeft + 'px';
        img.style.top = targetTop + 'px';
        img.style.width = targetSize + 'px';
        img.style.height = targetSize + 'px';
        document.body.appendChild(img);
        const anim = img.animate(
            [
                { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 1 },
                { transform: 'none', opacity: 0 },
            ],
            { duration: 650, easing: 'cubic-bezier(0.4, 0.7, 0.5, 1)', fill: 'forwards' }
        );
        anim.onfinish = () => img.remove();
        anim.oncancel = () => img.remove();
    });
</script>

<div class="play-shell" role="main">
    <div class="title-strip" class:visible={titleVisible} bind:this={flyTargetEl} aria-hidden={!titleVisible}>
        <span class="play-title">{$loadedCartridge?.name ?? 'SvelteBoy'}</span>
    </div>

    <PlayRail />
    <OnboardingCard />

    <RomDropZone onRomReceived={Emulator.PlayRom} bind:dragState>
        <div
            class="play-stage"
            class:drop-allowed={dragState == DragState.Accept}
            class:drop-disallowed={dragState == DragState.Reject}
            bind:this={screenEl}
        >
            <div
                class="screen-tap"
                ondblclick={toggleFullscreen}
                onclick={onScreenTap}
                role="presentation"
                bind:this={screenTapEl}
            >
                <WebGLCanvas
                    bind:this={webglCanvas}
                    palette={PALETTE_PRESETS[$SelectedPaletteIndex]}
                    cgbColor={$CgbColor}
                    ghostingStrength={$GhostingStrength}
                    pixelPerfect={$PixelPerfect}
                />
                {#if $EmulatorPaused && hasRom}
                    <div class="pause-overlay">PAUSE</div>
                {/if}
                <HudOverlay />
            </div>
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

    {#if isCoarsePointer}
        <div class="play-controls">
            <LocalInputViewer />
        </div>
    {/if}
</div>

<style>
    .play-shell {
        min-height: 100dvh;
        background: var(--page-bg, #0a0a12);
        color: var(--text-color, #cdd6f4);
        display: flex;
        flex-direction: column;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    }
    .play-shell:focus,
    .play-shell:focus-within {
        outline: none;
    }

    .title-strip {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 55;
        padding: 0.6em 1em calc(0.6em + 1.2em);
        background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
        pointer-events: none;
        opacity: 0;
        transform: translateY(-0.4em);
        transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .title-strip.visible {
        opacity: 1;
        transform: translateY(0);
    }
    .play-title {
        font-weight: 600;
        font-size: 1em;
        color: #fff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 80vw;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }

    .play-stage {
        flex: 1;
        min-height: 0;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5em;
    }
    .play-stage.drop-allowed {
        background-color: rgba(96, 140, 184, 0.25);
    }
    .play-stage.drop-disallowed {
        background-color: rgba(122, 107, 104, 0.25);
    }

    .play-stage:fullscreen {
        padding: 0;
        background: #000;
        width: 100vw;
        height: 100dvh;
    }
    .play-stage:fullscreen .screen-tap {
        width: 100%;
        height: 100%;
    }

    .screen-tap {
        position: relative;
        display: block;
        line-height: 0;
        width: min(100%, 100dvh * 10 / 9);
        aspect-ratio: 10 / 9;
        max-height: 100%;
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
        background: rgba(0,0,0,0.75);
        border: none;
        color: #fff;
        font-size: 0.85em;
        cursor: pointer;
        border-radius: 0.4em;
        padding: 0.3em 0.7em;
        white-space: nowrap;
        z-index: 10;
    }
    .audio-hint:hover {
        background: rgba(0,0,0,0.9);
    }

    .pause-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.4);
        color: rgba(255, 255, 255, 0.4);
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-size: 15cqmin;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        pointer-events: none;
        user-select: none;
    }

    .play-controls {
        container-type: inline-size;
        width: 100%;
        max-width: 720px;
        align-self: center;
        padding-bottom: env(safe-area-inset-bottom);
    }
</style>
