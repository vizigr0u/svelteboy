<script lang="ts">
    import type { Snippet } from "svelte";
    import type { LayoutId } from "../../types";
    import ConsoleLayout from "./ConsoleLayout.svelte";
    import CompactLayout from "./CompactLayout.svelte";
    import DebugLayout from "./DebugLayout.svelte";
    import ImmersiveLayout from "./ImmersiveLayout.svelte";

    interface MenuItem {
        label: string;
        active: boolean;
        toggle: () => void;
        disabled?: boolean;
        header?: string;
    }

    interface Props {
        layout: LayoutId;
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

    let props: Props = $props();
</script>

{#if props.layout === 'console'}
    <ConsoleLayout {...props} />
{:else if props.layout === 'compact'}
    <CompactLayout {...props} />
{:else if props.layout === 'debug'}
    <DebugLayout {...props} />
{:else}
    <ImmersiveLayout {...props} />
{/if}
