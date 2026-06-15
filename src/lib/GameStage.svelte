<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import {
        SelectedPaletteIndex,
        PALETTE_PRESETS,
        CgbColor,
        GhostingStrength,
        PixelPerfect,
    } from "stores/optionsStore";
    import { Emulator } from "../emulator";
    import { registerShadedCanvas } from "../screenshot";
    import {
        chromeVisible, revealChrome, hideChrome, markInteracted,
    } from "stores/playUiStore";
    import WebGLCanvas from "./WebGLCanvas.svelte";
    import HudOverlay from "./hud/HudOverlay.svelte";
    import PlayerChrome from "./PlayerChrome.svelte";
    import LocalInputViewer from "./LocalInputViewer.svelte";

    // Keystone: composes game view (WebGLCanvas + HUD + chrome) and the virtual pad
    // into one arrangement. One persistent instance drives both full Play and the
    // mini-console (single WebGL canvas, T2) — props restyle, never remount the canvas.
    let {
        layout,
        size = "full",
        interactive = true,
        showPad = false,
        minimalChrome = false,
        hasRom = false,
        coarse = false,
        onRequestFullscreen,
        registerScreenEl,
    }: {
        layout: "portrait" | "landscape";
        size?: "full" | "mini";
        interactive?: boolean;
        showPad?: boolean;
        minimalChrome?: boolean;
        hasRom?: boolean;
        coarse?: boolean;
        onRequestFullscreen?: () => void;
        registerScreenEl?: (el: HTMLDivElement | undefined) => void;
    } = $props();

    let webglCanvas: { draw: (frame: Uint8Array | Uint16Array) => void; getCanvas: () => HTMLCanvasElement } | null = $state(null);
    let screenEl: HTMLDivElement | undefined = $state();

    const DOUBLE_TAP_MS = 280;
    let lastTapTime = 0;
    let pendingTapTimer: ReturnType<typeof setTimeout> | null = null;

    // Coarse single-tap toggles chrome; double-tap → fullscreen.
    // Taps on chrome controls are handled by the controls themselves.
    function onScreenTap(e: MouseEvent) {
        if (!coarse || !hasRom) return;
        if ((e.target as HTMLElement).closest(".chrome button")) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastTapTime < DOUBLE_TAP_MS) {
            if (pendingTapTimer) { clearTimeout(pendingTapTimer); pendingTapTimer = null; }
            lastTapTime = 0;
            onRequestFullscreen?.();
            return;
        }
        lastTapTime = now;
        if (pendingTapTimer) clearTimeout(pendingTapTimer);
        pendingTapTimer = setTimeout(() => {
            markInteracted();
            if (get(chromeVisible)) hideChrome(); else revealChrome();
            pendingTapTimer = null;
        }, DOUBLE_TAP_MS);
    }

    function onScreenDblClick() {
        if (coarse) return;
        onRequestFullscreen?.();
    }

    $effect(() => { registerScreenEl?.(screenEl); });

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
        return () => {
            Emulator.RemoveRenderCallback(drawCallback);
            registerShadedCanvas(null);
            registerScreenEl?.(undefined);
        };
    });
</script>

<div
    class="stage"
    class:landscape={layout === "landscape"}
    class:mini={size === "mini"}
>
    <div class="game-area">
        <div
            class="screen-tap"
            class:non-interactive={!interactive}
            onclick={onScreenTap}
            ondblclick={onScreenDblClick}
            role="presentation"
            bind:this={screenEl}
        >
            <WebGLCanvas
                bind:this={webglCanvas}
                palette={PALETTE_PRESETS[$SelectedPaletteIndex]}
                cgbColor={$CgbColor}
                ghostingStrength={$GhostingStrength}
                pixelPerfect={$PixelPerfect}
            />
            <HudOverlay />
            {#if hasRom}
                <PlayerChrome minimal={minimalChrome} />
            {/if}
        </div>
    </div>

    {#if showPad}
        {#if layout === "landscape"}
            <div class="pad-layer sides">
                <LocalInputViewer mode="sides" />
            </div>
        {:else}
            <div class="pad-layer bar">
                <LocalInputViewer mode="bar" />
            </div>
        {/if}
    {/if}
</div>

<style>
    /* container-type:size gives both the game (cqh) and the sides pad (cqmin) a
       sizing context that scales with the stage — full or mini, same component. */
    .stage {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        container-type: size;
    }

    .game-area {
        flex: 1;
        min-height: 0;
        position: relative;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 0.5em;
    }
    .stage.mini .game-area { padding: 0.2em; }

    .screen-tap {
        position: relative;
        display: block;
        line-height: 0;
        width: min(100%, 100cqh * 10 / 9);
        aspect-ratio: 10 / 9;
        max-height: 100%;
    }
    /* Landscape: game view takes full height, as big as possible; the sides pad
       overlays the horizontal slack (and game edges when slack is thin). */
    .stage.landscape .screen-tap {
        width: min(100cqw, 100cqh * 10 / 9);
        max-height: 100%;
    }
    .screen-tap.non-interactive { pointer-events: none; }

    /* Portrait pad: flows below the game as a bar. */
    .pad-layer.bar {
        container-type: inline-size;
        width: 100%;
        max-width: 720px;
        align-self: center;
        padding-bottom: env(safe-area-inset-bottom);
    }

    /* Landscape pad: absolute overlay filling the stage; clusters pin to edges.
       container-relative now (T1) so it nests in the mini-console too. */
    .pad-layer.sides {
        position: absolute;
        inset: 0;
        z-index: var(--z-content);
        pointer-events: none;
    }
</style>
