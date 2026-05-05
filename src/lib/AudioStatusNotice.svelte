<script lang="ts">
    import { AudioMode } from "../emulator/audio";

    let dismissed = $state(false);

    function dismiss() {
        try {
            sessionStorage.setItem("audio-status-dismissed", "1");
        } catch (_) {}
        dismissed = true;
    }

    let initialDismissed = false;
    try {
        initialDismissed = sessionStorage.getItem("audio-status-dismissed") === "1";
    } catch (_) {}
    dismissed = initialDismissed;
</script>

{#if $AudioMode === "none" && !dismissed}
    <div class="notice error" role="alert">
        <span class="notice-text">
            Audio unavailable on this browser. Try Chrome, Firefox, or Safari 16.4+.
        </span>
        <button type="button" class="notice-close" aria-label="Dismiss" onclick={dismiss}>×</button>
    </div>
{/if}

<style>
    .notice {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 401;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.5em 0.9em;
        font-size: 0.9em;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        background: #f38ba8;
        color: #1e1e2e;
    }
    .notice-text {
        flex: 1;
    }
    .notice-close {
        background: transparent;
        border: none;
        color: inherit;
        font-size: 1.4em;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.3em;
    }
    .notice-close:hover {
        opacity: 0.7;
    }
</style>
