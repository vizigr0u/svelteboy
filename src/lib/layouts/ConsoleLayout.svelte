<script lang="ts">
    import type { Snippet } from "svelte";
    import BurgerMenu from "../BurgerMenu.svelte";
    import LocalInputViewer from "../LocalInputViewer.svelte";

    interface MenuItem {
        label: string;
        active: boolean;
        toggle: () => void;
        disabled?: boolean;
    }

    interface Props {
        menuItems: MenuItem[];
        menuOpen: boolean;
        onMenuToggle: () => void;
        onMenuClose: () => void;
        screen: Snippet;
        windows?: Snippet<[mode: 'modal' | 'docked']>;
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

<div class="console">
    <div class="inner">
        <div class="screen-frame" bind:this={screenFrameEl}>
            {@render screen()}
            {@render windows?.('modal')}
        </div>
        <div class="menu-bar">
            <span class="console-name">Svelte BOY</span>
            {#if menuOpen}
                <div class="menu-backdrop" onclick={onMenuClose} role="presentation" aria-hidden="true"></div>
            {/if}
            <div class="burger-wrap">
                {#if menuOpen}
                    <BurgerMenu items={menuItems} />
                {/if}
                <button class="burger-btn" onclick={onMenuToggle} aria-label="Menu" bind:this={burgerBtnEl}>☰</button>
            </div>
        </div>
    </div>
    <LocalInputViewer />
</div>

<style>
    .console {
        container-type: size;
        aspect-ratio: 9 / 13;
        background-color: #bbb;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        border-radius: 2% 2% 9% 2%;
        border: 4px solid transparent;
        gap: 10cqmin;
        padding: 8cqmin 0 0 0;
        height: calc(100dvh - var(--safe-top) - var(--safe-bottom));
        width: auto;
        margin-left: auto;
    }

    @media (max-aspect-ratio: 9/13) {
        .console {
            width: 100vw;
            height: auto;
            max-height: 100dvh;
        }
    }

    .inner {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .screen-frame {
        position: relative;
        padding: 2cqmin 5cqmin;
        background-color: #68717a;
        border-radius: 1% 1% 4% 1%;
        width: 90cqmin;
        height: 76cqmin;
        box-sizing: border-box;
    }

    .screen-frame:fullscreen {
        padding: 0;
        margin: 0;
        background-color: #000;
        border-radius: 0;
        width: 100vw;
        height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .menu-bar {
        display: flex;
        width: 100%;
        padding: 0.2em 0.5em;
        margin-top: 0.5cqmin;
        gap: 0.5em;
    }

    .console-name {
        font-family: "Courier New", Courier, monospace;
        color: #12153d;
        font-weight: bold;
        font-size: 6cqi;
        margin: 0 3% 0 5%;
        align-self: flex-start;
        font-style: italic;
        text-transform: uppercase;
    }

    .burger-wrap {
        position: relative;
        margin-left: auto;
        align-self: flex-start;
        display: flex;
    }

    .burger-btn {
        width: 6cqmin;
        height: 6cqmin;
        background: rgba(0,0,0,0.4);
        border: none;
        color: #eee;
        font-size: 4cqmin;
        cursor: pointer;
        border-radius: 0.2em;
        padding: 0 0.3em;
        line-height: 1;
    }

    .burger-btn:hover {
        background: rgba(0,0,0,0.7);
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 199;
    }
</style>
