<script lang="ts">
    import { onMount } from "svelte";

    type Severity = "info" | "warn" | "error";
    type MotdEntry = {
        id: string;
        message: string;
        until?: string;
        severity?: Severity;
    };

    let entry = $state<MotdEntry | null>(null);
    let dismissed = $state(false);

    function isActive(e: MotdEntry): boolean {
        if (!e.until) return true;
        const t = Date.parse(e.until);
        return Number.isFinite(t) ? Date.now() < t : true;
    }

    function storageKey(id: string): string {
        return `motd-dismissed-${id}`;
    }

    onMount(async () => {
        try {
            const res = await fetch(`motd.json?t=${Date.now()}`, { cache: "no-cache" });
            if (!res.ok) return;
            const data = (await res.json()) as MotdEntry[];
            if (!Array.isArray(data) || data.length === 0) return;
            const active = data.filter((e) => e && typeof e.id === "string" && typeof e.message === "string" && isActive(e));
            if (active.length === 0) return;
            const pick = active[Math.floor(Math.random() * active.length)];
            try {
                if (sessionStorage.getItem(storageKey(pick.id)) === "1") return;
            } catch (_) {}
            entry = pick;
        } catch (_) {}
    });

    function dismiss() {
        if (!entry) return;
        try {
            sessionStorage.setItem(storageKey(entry.id), "1");
        } catch (_) {}
        dismissed = true;
    }
</script>

{#if entry && !dismissed}
    <div class="motd {entry.severity ?? 'info'}" role="status">
        <span class="motd-text">{entry.message}</span>
        <button type="button" class="motd-close" aria-label="Dismiss" onclick={dismiss}>×</button>
    </div>
{/if}

<style>
    .motd {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 400;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: calc(0.5em + var(--safe-top)) calc(0.9em + var(--safe-right)) 0.5em calc(0.9em + var(--safe-left));
        font-size: 0.9em;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    .motd.info {
        background: #89b4fa;
        color: #1e1e2e;
    }
    .motd.warn {
        background: #f9e2af;
        color: #1e1e2e;
    }
    .motd.error {
        background: #f38ba8;
        color: #1e1e2e;
    }
    .motd-text {
        flex: 1;
    }
    .motd-close {
        background: transparent;
        border: none;
        color: inherit;
        font-size: 1.4em;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.3em;
    }
    .motd-close:hover {
        opacity: 0.7;
    }
</style>
