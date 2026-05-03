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
    <div class="backdrop" onclick={() => close(false)} role="presentation" aria-hidden="true"></div>
    <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="title" id="confirm-title">{$confirmRequest.title}</div>
        <div class="message">{$confirmRequest.message}</div>
        <div class="actions">
            <button class="cancel" onclick={() => close(false)}>{$confirmRequest.cancelLabel ?? 'Cancel'}</button>
            <button class="confirm" onclick={() => close(true)}>{$confirmRequest.confirmLabel ?? 'OK'}</button>
        </div>
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.5);
    }
    .dialog {
        position: fixed;
        z-index: 201;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e2e;
        color: #cdd6f4;
        border: 1px solid #45475a;
        border-radius: 0.5em;
        padding: 1em;
        min-width: 280px;
        max-width: min(90vw, 480px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
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
    button {
        padding: 0.4em 0.9em;
        border-radius: 0.3em;
        border: 1px solid #45475a;
        background: #313244;
        color: #cdd6f4;
        cursor: pointer;
        font-size: 0.9em;
    }
    button:hover {
        background: #45475a;
    }
    button.confirm {
        background: #89b4fa;
        color: #1e1e2e;
        border-color: #89b4fa;
    }
    button.confirm:hover {
        background: #74a0e8;
    }
</style>
