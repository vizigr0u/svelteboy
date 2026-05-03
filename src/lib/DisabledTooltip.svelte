<script lang="ts">
    import type { Snippet } from "svelte";
    import { showToast } from "stores/toastStore";

    interface Props {
        disabled: boolean;
        message: string;
        children: Snippet;
    }

    let { disabled, message, children }: Props = $props();
    let hovered = $state(false);

    function isCoarsePointer(): boolean {
        return typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(pointer: coarse)').matches;
    }

    function onPointerDownCapture(e: PointerEvent) {
        if (!disabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (isCoarsePointer()) showToast(message, 'info');
    }

    function onClickCapture(e: MouseEvent) {
        if (!disabled) return;
        e.preventDefault();
        e.stopPropagation();
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
    class="wrap"
    class:disabled
    aria-disabled={disabled || undefined}
    onmouseenter={() => (hovered = true)}
    onmouseleave={() => (hovered = false)}
    onpointerdowncapture={onPointerDownCapture}
    onclickcapture={onClickCapture}
>
    {@render children()}
    {#if disabled && hovered}
        <span class="tooltip" role="tooltip">{message}</span>
    {/if}
</span>

<style>
    .wrap {
        position: relative;
        display: inline-block;
    }
    .wrap.disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .tooltip {
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #1e1e2e;
        color: #cdd6f4;
        border: 1px solid #45475a;
        padding: 0.35em 0.6em;
        border-radius: 0.3em;
        font-size: 0.78em;
        white-space: nowrap;
        pointer-events: none;
        z-index: 250;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }
</style>
