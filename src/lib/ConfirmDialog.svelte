<script lang="ts">
    import { confirmRequest } from "stores/confirmStore";

    function close(ok: boolean) {
        const req = $confirmRequest;
        if (!req) return;
        confirmRequest.set(null);
        req.resolve(ok);
    }

    function onKeydown(e: KeyboardEvent) {
        if (!$confirmRequest) return;
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter') close(true);
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#if $confirmRequest}
    <div class="scrim" onclick={() => close(false)} role="presentation" aria-hidden="true"></div>
    <div class="dialog modal-shell" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="title" id="confirm-title">{$confirmRequest.title}</div>
        <div class="message">{$confirmRequest.message}</div>
        <div class="actions">
            <button class="btn btn-secondary" onclick={() => close(false)}>{$confirmRequest.cancelLabel ?? 'Cancel'}</button>
            <button class="btn btn-primary" onclick={() => close(true)}>{$confirmRequest.confirmLabel ?? 'OK'}</button>
        </div>
    </div>
{/if}

<style>
    /* .scrim + .modal-shell from app.css supply backdrop + shell; local = centering, padding, sizing */
    .dialog {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 1em;
        min-width: 280px;
        max-width: min(90vw, 480px);
    }
    .title {
        font-weight: bold;
        font-size: 1em;
        margin-bottom: 0.5em;
    }
    .message {
        font-size: 0.9em;
        margin-bottom: 1em;
        white-space: pre-wrap;
    }
    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5em;
    }
    .actions .btn {
        min-height: 2.25rem;
        padding-inline: var(--space-3);
        font-size: 0.9em;
    }
</style>
