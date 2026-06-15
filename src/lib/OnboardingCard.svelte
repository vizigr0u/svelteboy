<script lang="ts">
    import { onMount } from "svelte";
    import { onboardingReady, onboardingDismissed, dismissOnboarding } from "stores/onboardingStore";

    let isCoarse = $state(false);

    onMount(() => {
        const mql = window.matchMedia("(pointer: coarse)");
        const upd = () => (isCoarse = mql.matches);
        upd();
        mql.addEventListener("change", upd);
        // First real interaction dismisses the card via markInteracted() ->
        // onboardingDismissed; the "Got it" button is the explicit fallback.
        return () => { mql.removeEventListener("change", upd); };
    });

    let show = $derived($onboardingReady && !$onboardingDismissed);
    let text = $derived(isCoarse
        ? "Tap the screen for the menu."
        : "Press Esc or move the mouse for the menu.");
</script>

{#if show}
    <div class="onboard" role="status">
        <span class="msg">{text}</span>
        <button class="dismiss" onclick={dismissOnboarding} aria-label="Dismiss">Got it</button>
    </div>
{/if}

<style>
    .onboard {
        position: fixed;
        left: 50%;
        bottom: 1.2em;
        transform: translateX(-50%);
        z-index: var(--z-hud);
        display: flex;
        align-items: center;
        gap: 0.8em;
        background: rgba(30, 30, 46, 0.95);
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 0.6em;
        padding: 0.6em 0.9em;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
        max-width: 90vw;
        animation: rise 0.3s ease-out;
    }
    .msg { font-size: 0.9em; }
    .dismiss {
        background: var(--highlight-color);
        color: var(--background-color);
        border: none;
        border-radius: 0.4em;
        padding: 0.35em 0.8em;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
    }
    @keyframes rise {
        from { opacity: 0; transform: translate(-50%, 0.5em); }
        to   { opacity: 1; transform: translate(-50%, 0); }
    }
</style>
