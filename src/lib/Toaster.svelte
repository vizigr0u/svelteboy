<script lang="ts">
    import { toasts, dismissToast } from "stores/toastStore";
</script>

<div class="toaster" aria-live="polite">
    {#each $toasts as t (t.id)}
        <button type="button" class="toast {t.kind}" onclick={() => dismissToast(t.id)} aria-label={t.message}>
            {t.message}
        </button>
    {/each}
</div>

<style>
    .toaster {
        position: fixed;
        bottom: 1em;
        right: 1em;
        z-index: var(--z-modal);
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        pointer-events: none;
    }
    .toast {
        background: var(--panel-color);
        color: var(--text-color);
        padding: 0.6em 0.9em;
        border-radius: 0.3em;
        border: 1px solid var(--border-color);
        font-size: 0.85em;
        max-width: 320px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        pointer-events: auto;
        font-family: inherit;
        text-align: left;
    }
    .toast.error {
        background: #43253a;
        border-color: var(--danger-color);
        color: #f5e0dc;
    }
    .toast.success {
        background: #1e3a2e;
        border-color: var(--success-color);
        color: #d9fcd0;
    }
</style>
