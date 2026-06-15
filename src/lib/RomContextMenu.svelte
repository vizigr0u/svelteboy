<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Icon from "./icons/Icon.svelte";
    import { Emulator } from "../emulator";
    import { romMenu, closeRomMenu } from "stores/romMenuStore";
    import { deleteLibraryRom, promoteUriToIdb } from "stores/libraryStore";
    import { requestConfirm } from "stores/confirmStore";

    let menu = $derived($romMenu);

    function play() {
        if (!menu) return;
        Emulator.ResumeRom(menu.rom);
        closeRomMenu();
    }
    function playFromBoot() {
        if (!menu) return;
        Emulator.PlayRom(menu.rom, { purgeAutoOnLoad: true });
        closeRomMenu();
    }
    async function addToLibrary() {
        const rom = menu?.rom;
        closeRomMenu();
        if (!rom || rom.source.kind !== "uri") return;
        const res = await fetch(rom.source.uri);
        if (!res.ok) return;
        await promoteUriToIdb(rom.sha1, await res.arrayBuffer());
    }
    async function remove() {
        const rom = menu?.rom;
        closeRomMenu();
        if (!rom) return;
        const ok = await requestConfirm({
            title: "Remove ROM",
            message: `Remove "${rom.name}" from your library? Save states stay on disk.`,
            confirmLabel: "Remove",
            cancelLabel: "Cancel",
        });
        if (ok) await deleteLibraryRom(rom.sha1);
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === "Escape" && $romMenu) { e.stopPropagation(); closeRomMenu(); }
    }
    onMount(() => window.addEventListener("keydown", onKey, true));
    onDestroy(() => window.removeEventListener("keydown", onKey, true));
</script>

{#if menu}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="menu-backdrop" onclick={closeRomMenu} oncontextmenu={(e) => { e.preventDefault(); closeRomMenu(); }}>
        <div class="menu" style:left="{menu.x}px" style:top="{menu.y}px" role="menu">
            <div class="menu-title" title={menu.rom.name}>{menu.rom.name}</div>
            <button role="menuitem" onclick={play}><Icon name="circle-play" /> Play</button>
            <button role="menuitem" onclick={playFromBoot}><Icon name="rotate" /> Play from boot</button>
            {#if menu.rom.source.kind === "uri"}
                <button role="menuitem" onclick={addToLibrary}><Icon name="cloud-arrow-down" /> Add to library</button>
            {/if}
            <button role="menuitem" class="danger" onclick={remove}><Icon name="trash" /> Remove</button>
        </div>
    </div>
{/if}

<style>
    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
    }
    .menu {
        position: fixed;
        min-width: 12em;
        max-width: 80vw;
        background: #1e1e2e;
        color: #cdd6f4;
        border: 1px solid #45475a;
        border-radius: 0.4em;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
        padding: 0.3em;
        display: flex;
        flex-direction: column;
        gap: 0.1em;
    }
    .menu-title {
        font-size: 0.75em;
        color: #888;
        padding: 0.3em 0.5em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        border-bottom: 1px solid #313244;
        margin-bottom: 0.2em;
    }
    .menu button {
        display: flex;
        align-items: center;
        gap: 0.5em;
        background: none;
        border: none;
        color: inherit;
        text-align: left;
        padding: 0.5em 0.6em;
        border-radius: 0.3em;
        cursor: pointer;
        font-size: 0.9em;
    }
    .menu button:hover { background: rgba(255, 255, 255, 0.08); }
    .menu button.danger { color: #f38ba8; }
    .menu button.danger:hover { background: rgba(243, 139, 168, 0.12); }
</style>
