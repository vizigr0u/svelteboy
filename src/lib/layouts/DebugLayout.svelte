<script lang="ts">
    import type { Snippet } from "svelte";
    import BurgerMenu from "../BurgerMenu.svelte";

    interface MenuItem {
        label: string;
        active: boolean;
        toggle: () => void;
        disabled?: boolean;
        header?: string;
    }

    interface Props {
        menuItems: MenuItem[];
        menuOpen: boolean;
        onMenuToggle: () => void;
        onMenuClose: () => void;
        screen: Snippet;
        windows?: Snippet<[mode: 'modal' | 'docked']>;
        debugInline?: Snippet;
        burgerRef?: (el: HTMLButtonElement | null) => void;
        fullscreenTargetRef?: (el: HTMLElement | null) => void;
    }

    let { menuItems, menuOpen, onMenuToggle, onMenuClose, screen, windows, debugInline, burgerRef, fullscreenTargetRef }: Props = $props();

    let burgerBtnEl: HTMLButtonElement | undefined = $state();
    let screenFrameEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        burgerRef?.(burgerBtnEl ?? null);
        return () => burgerRef?.(null);
    });

    $effect(() => {
        fullscreenTargetRef?.(screenFrameEl ?? null);
        return () => fullscreenTargetRef?.(null);
    });
</script>

<div class="debug-layout">
    <div class="topbar">
        <span class="title">Svelte BOY · Debug</span>
        {#if menuOpen}
            <div class="menu-backdrop" onclick={onMenuClose} role="presentation" aria-hidden="true"></div>
        {/if}
        <div class="burger-wrap">
            {#if menuOpen}
                <BurgerMenu items={menuItems} direction="down" />
            {/if}
            <button class="burger-btn" onclick={onMenuToggle} aria-label="Menu" bind:this={burgerBtnEl}>☰</button>
        </div>
    </div>

    <div class="body">
        <div class="screen-col">
            <div class="screen-frame" bind:this={screenFrameEl}>
                {@render screen()}
            </div>
        </div>
        <section class="debug-pane">
            {@render debugInline?.()}
        </section>
    </div>

    {@render windows?.('modal')}
</div>

<style>
    .debug-layout {
        --screen-w: 480px;
        --screen-h: 432px;
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100dvh;
    }

    .topbar {
        display: flex;
        align-items: center;
        gap: 0.75em;
        padding: 0.4em 0.75em;
        background: #1e1e2e;
        color: #cdd6f4;
        border-bottom: 1px solid #45475a;
    }

    .title {
        font-family: "Courier New", Courier, monospace;
        font-weight: bold;
        font-style: italic;
        text-transform: uppercase;
        font-size: 1em;
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        display: flex;
    }

    .burger-btn {
        background: rgba(255,255,255,0.08);
        border: none;
        color: #eee;
        font-size: 1.1em;
        cursor: pointer;
        border-radius: 0.2em;
        padding: 0.15em 0.5em;
        line-height: 1;
    }

    .burger-btn:hover {
        background: rgba(255,255,255,0.15);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }

    .body {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1em;
        padding: 1em;
    }

    .screen-col {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5em;
    }

    .screen-frame {
        width: var(--screen-w);
        height: var(--screen-h);
        background: #000;
        border-radius: 4px;
        position: relative;
    }

    .debug-pane {
        min-width: 0;
        overflow: auto;
    }

    @media (max-width: 1100px) {
        .body {
            grid-template-columns: 1fr;
        }
    }
</style>
