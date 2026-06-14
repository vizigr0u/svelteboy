<script lang="ts">
    import { AudioMode } from "../emulator/audio";
    import { showToast } from "stores/toastStore";

    const KEY = "audio-status-dismissed";
    let shown = false;

    $effect(() => {
        if ($AudioMode !== "none" || shown) return;
        try {
            if (sessionStorage.getItem(KEY) === "1") { shown = true; return; }
            sessionStorage.setItem(KEY, "1");
        } catch (_) {}
        shown = true;
        showToast(
            "Audio unavailable on this browser. Try Chrome, Firefox, or Safari 16.4+.",
            "error",
            8000,
        );
    });
</script>
