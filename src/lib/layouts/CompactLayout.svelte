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

    let { menuItems, menuOpen, onMenuToggle, onMenuClose, screen, windows, burgerRef, fullscreenTargetRef }: Props = $props();

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

<div class="compact">
    <div class="topbar">
        <span class="title">Svelte BOY</span>
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
        <aside class="dock">
            {@render windows?.('docked')}
        </aside>
    </div>
</div>

<style>
    .compact {
        --screen-w: min(60vw, 80vh * 10 / 9);
        --screen-h: calc(var(--screen-w) * 9 / 10);
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100dvh;
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
        grid-template-columns: minmax(0, auto) minmax(280px, 1fr);
        gap: 1em;
        padding: 1em;
    }

    .screen-col {
        display: flex;
        align-items: flex-start;
        justify-content: center;
    }

    .screen-frame {
        width: var(--screen-w);
        height: var(--screen-h);
        background: #000;
        border-radius: 4px;
        position: relative;
    }

    .dock {
        display: flex;
        flex-direction: column;
        gap: 0.75em;
        min-width: 0;
        overflow-y: auto;
    }

    @media (max-width: 800px) {
        .body {
            grid-template-columns: 1fr;
        }
    }
</style>
