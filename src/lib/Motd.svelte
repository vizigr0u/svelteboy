<script lang="ts">
    import { onMount } from "svelte";
    import { showToast, type ToastKind } from "stores/toastStore";

    type Severity = "info" | "warn" | "error";
    type MotdEntry = {
        id: string;
        message: string;
        until?: string;
        severity?: Severity;
    };

    function isActive(e: MotdEntry): boolean {
        if (!e.until) return true;
        const t = Date.parse(e.until);
        return Number.isFinite(t) ? Date.now() < t : true;
    }

    function storageKey(id: string): string {
        return `motd-dismissed-${id}`;
    }

    function toastKind(s?: Severity): ToastKind {
        return s === "error" ? "error" : "info";
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
                sessionStorage.setItem(storageKey(pick.id), "1");
            } catch (_) {}
            showToast(pick.message, toastKind(pick.severity), 8000);
        } catch (_) {}
    });
</script>
