<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "../icons/Icon.svelte";
    import { openOverlay } from "stores/overlayStore";

    // Desktop-only vertical rail: 2 icons, visible 3s on session entry, then auto-hide.
    // An 8px left-edge hot-zone re-shows it on cursor approach.
    let visible = $state(true);
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { visible = false; hideTimer = null; }, 3000);
    }
    function reveal() {
        visible = true;
        scheduleHide();
    }

    onMount(() => {
        scheduleHide();
        const onMove = (e: PointerEvent) => {
            if (e.clientX <= 8) reveal();
        };
        window.addEventListener("pointermove", onMove);
        return () => {
            window.removeEventListener("pointermove", onMove);
            if (hideTimer) clearTimeout(hideTimer);
        };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<nav class="rail" class:visible onpointerenter={reveal}>
    <button class="rail-btn" title="Library" aria-label="Library" onclick={() => openOverlay('library')}>
        <Icon name="hard-drive" />
    </button>
    <button class="rail-btn" title="Options" aria-label="Options" onclick={() => openOverlay('options')}>
        <Icon name="filter" />
    </button>
</nav>

<style>
    .rail {
        position: fixed;
        left: 0;
        top: 50%;
        transform: translate(-110%, -50%);
        z-index: 60;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        padding: 0.5em 0.4em;
        background: rgba(20, 20, 30, 0.7);
        border-radius: 0 0.6em 0.6em 0;
        backdrop-filter: blur(8px);
        transition: transform 0.25s ease;
    }
    .rail.visible { transform: translate(0, -50%); }
    .rail-btn {
        background: rgba(255, 255, 255, 0.06);
        border: none;
        color: #cdd6f4;
        font-size: 1.2em;
        width: 1.9em;
        height: 1.9em;
        border-radius: 0.4em;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .rail-btn:hover { background: rgba(255, 255, 255, 0.14); }
    @media (pointer: coarse) {
        .rail { display: none; }
    }
</style>
