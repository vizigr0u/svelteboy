<script lang="ts">
    import type { Snippet } from "svelte";
    import BurgerMenu from "../BurgerMenu.svelte";
    import LocalInputViewer from "../LocalInputViewer.svelte";
    import { ImmersiveControlsPlacement } from "../../stores/layoutStore";

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
    let rootEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        burgerRef?.(burgerBtnEl ?? null);
        return () => burgerRef?.(null);
    });

    $effect(() => {
        fullscreenTargetRef?.(rootEl ?? null);
        return () => fullscreenTargetRef?.(null);
    });
</script>

<div class="immersive" data-placement={$ImmersiveControlsPlacement} bind:this={rootEl}>
    <div class="screen-frame">
        {@render screen()}
    </div>

    <div class="controls">
        <LocalInputViewer />
    </div>

    {#if menuOpen}
        <div class="menu-backdrop" onclick={onMenuClose} role="presentation" aria-hidden="true"></div>
    {/if}
    <div class="burger-wrap">
        {#if menuOpen}
            <BurgerMenu items={menuItems} direction="down" />
        {/if}
        <button class="burger-btn" onclick={onMenuToggle} aria-label="Menu" bind:this={burgerBtnEl}>☰</button>
    </div>

    {@render windows?.('modal')}
</div>

<style>
    .immersive {
        position: relative;
        width: 100%;
        height: 100dvh;
        background: #000;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .screen-frame {
        flex: 1;
        min-height: 0;
        position: relative;
    }

    .immersive[data-placement="shrink"] .screen-frame {
        flex: 1 1 auto;
    }

    .immersive[data-placement="bleed"] .screen-frame,
    .immersive[data-placement="overlay"] .screen-frame {
        position: absolute;
        inset: 0;
    }

    .controls {
        position: relative;
        z-index: 5;
    }

    .immersive[data-placement="bleed"] .controls,
    .immersive[data-placement="overlay"] .controls {
        position: absolute;
        inset: auto 0 0 0;
        background: transparent;
    }

    .burger-wrap {
        position: absolute;
        top: 0.4em;
        right: 0.4em;
        z-index: 10;
        display: flex;
    }

    .burger-btn {
        background: rgba(0,0,0,0.5);
        border: none;
        color: #eee;
        font-size: 1.2em;
        cursor: pointer;
        border-radius: 0.2em;
        padding: 0.15em 0.5em;
        line-height: 1;
    }

    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9;
    }
</style>
