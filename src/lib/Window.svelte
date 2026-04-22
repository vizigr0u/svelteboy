<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        title: string;
        onclose: () => void;
        children: Snippet;
        wide?: boolean;
    }

    let { title, onclose, children, wide = false }: Props = $props();
</script>

<div class="window" class:wide>
    <div class="window-header">
        <span class="window-title">{title}</span>
        <button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
    </div>
    <div class="window-body">
        {@render children()}
    </div>
</div>

<style>
    .window {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 100;
        background: #1e1e2e;
        color: #cdd6f4;
        border: 1px solid #45475a;
        border-radius: 0.5em;
        display: flex;
        flex-direction: column;
        max-height: 80vh;
        width: clamp(280px, 90vw, 500px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }

    .window.wide {
        width: clamp(280px, 95vw, 1400px);
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
