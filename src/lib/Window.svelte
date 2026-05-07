<script lang="ts">
    import type { Snippet } from "svelte";

    type WindowMode = 'modal' | 'docked';

    interface Props {
        title: string;
        onclose: () => void;
        children: Snippet;
        wide?: boolean;
        mode?: WindowMode;
    }

    let { title, onclose, children, wide = false, mode = 'modal' }: Props = $props();

    function stopProp(e: Event) {
        e.stopPropagation();
    }
</script>

{#if mode === 'modal'}
    <div
        class="backdrop"
        onclick={onclose}
        ondrop={stopProp}
        ondragover={stopProp}
        ondragenter={stopProp}
        ondragleave={stopProp}
        onkeydown={stopProp}
        onkeyup={stopProp}
        role="presentation"
        aria-hidden="true"
    ></div>
{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="window"
    class:wide
    class:modal={mode === 'modal'}
    class:docked={mode === 'docked'}
    ondrop={stopProp}
    ondragover={stopProp}
    ondragenter={stopProp}
    ondragleave={stopProp}
    onkeydown={stopProp}
    onkeyup={stopProp}
>
    <div class="window-header">
        <span class="window-title">{title}</span>
        <button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
    </div>
    <div class="window-body">
        {@render children()}
    </div>
</div>

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 99;
        background: rgba(0, 0, 0, 0.3);
    }

    .window {
        background: #1e1e2e;
        color: #cdd6f4;
        border: 1px solid #45475a;
        border-radius: 0.5em;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }

    .window.modal {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 100;
        max-height: 80vh;
        width: clamp(280px, 90vw, 500px);
    }

    .window.modal.wide {
        width: clamp(280px, 95vw, 1400px);
    }

    .window.docked {
        position: relative;
        width: 100%;
        max-height: 100%;
        min-height: 0;
        flex: 1 1 auto;
    }

    @media (max-width: 600px) {
        .window.modal, .window.modal.wide {
            position: fixed;
            inset: 0;
            top: 0;
            left: 0;
            width: 100vw;
            max-width: 100vw;
            max-height: 100dvh;
            border-radius: 0;
        }

        .window-body {
            flex: 1;
            min-height: 0;
        }
    }

    .window-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5em 0.75em;
        background: #313244;
        border-radius: 0.5em 0.5em 0 0;
        border-bottom: 1px solid #45475a;
        user-select: none;
    }

    .window-title {
        font-weight: bold;
        font-size: 0.95em;
    }

    .close-btn {
        background: none;
        border: none;
        color: #cdd6f4;
        cursor: pointer;
        font-size: 1em;
        padding: 0 0.25em;
        line-height: 1;
    }

    .close-btn:hover {
        color: #f38ba8;
    }

    .window-body {
        overflow-y: auto;
        padding: 0.75em;
    }
</style>
