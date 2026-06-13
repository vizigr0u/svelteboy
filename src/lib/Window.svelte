<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        title: string;
        onclose: () => void;
        children: Snippet;
        wide?: boolean;
    }

    let { title, onclose, children, wide = false }: Props = $props();

    function stopProp(e: Event) {
        e.stopPropagation();
    }
</script>

<div
    class="scrim"
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
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="window modal-shell"
    class:wide
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
    /* .scrim + .modal-shell from app.css supply backdrop + shell; local = centering, sizing, flex */
    /* mobile-first: base = fullscreen sheet (override modal-shell radius) */
    .window {
        inset: 0;
        display: flex;
        flex-direction: column;
        width: 100vw;
        max-width: 100vw;
        max-height: 100dvh;
        border-radius: 0;
    }

    .window-body {
        flex: 1;
        min-height: 0;
    }

    /* sm up: floating centered modal. 640px = --bp-sm */
    @media (min-width: 640px) {
        .window {
            inset: auto;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: clamp(280px, 90vw, 500px);
            max-width: none;
            max-height: 80vh;
            border-radius: var(--radius-lg);
        }

        .window.wide {
            width: clamp(280px, 95vw, 1400px);
        }
    }

    .window-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5em 0.75em;
        background: var(--panel-color);
        border-radius: 0.5em 0.5em 0 0;
        border-bottom: 1px solid var(--border-color);
        user-select: none;
    }

    .window-title {
        font-weight: bold;
        font-size: 0.95em;
    }

    .close-btn {
        background: none;
        border: none;
        color: var(--text-color);
        cursor: pointer;
        font-size: 1em;
        padding: 0 0.25em;
        line-height: 1;
    }

    .close-btn:hover {
        color: var(--danger-color);
    }

    .window-body {
        overflow-y: auto;
        padding: 0.75em;
    }
</style>
