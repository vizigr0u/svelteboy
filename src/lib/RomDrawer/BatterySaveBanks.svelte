<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import {
        batterySaveVersion,
        listBanks,
        loadBank,
        writeBank,
        renameBank,
        deleteBank,
        duplicateBank,
        getActiveBank,
        setActiveBank,
        listRing,
        generateBankId,
        type BankInfo,
        type BatteryRingEntry,
    } from "../../batterySaveDb";
    import { setActiveBankCache } from "../../activeBankCache";
    import { playRom } from "../../emulator/rom";
    import { loadedCartridge } from "stores/romStores";
    import { humanReadableSize } from "../../utils";
    import { requestConfirm } from "stores/confirmStore";
    import { showToast } from "stores/toastStore";
    import Icon from "../icons/Icon.svelte";
    import type { LibraryRom } from "../../types";

    let { sha1, name } = $props<{ sha1: string; name: string }>();

    let banks: BankInfo[] = $state([]);
    let activeBankId: string = $state("default");
    let ring: BatteryRingEntry[] = $state([]);
    let showRing: boolean = $state(false);
    let renamingId: string | null = $state(null);
    let renameValue: string = $state("");
    let renameCancelled: boolean = $state(false);

    $effect(() => {
        sha1;
        $batterySaveVersion;
        refresh();
    });

    async function refresh(): Promise<void> {
        const [b, a, r] = await Promise.all([
            listBanks(sha1),
            getActiveBank(sha1),
            listRing(sha1),
        ]);
        banks = b.sort((x, y) => y.savedAt - x.savedAt);
        activeBankId = a;
        ring = r;
    }

    function fmt(ts: number): string {
        return new Date(ts).toLocaleString();
    }

    function isCurrentRom(): boolean {
        const cart = get(loadedCartridge) as LibraryRom | undefined;
        return cart?.sha1 === sha1;
    }

    async function reloadIfCurrent(): Promise<void> {
        const cart = get(loadedCartridge) as LibraryRom | undefined;
        if (cart && cart.sha1 === sha1) await playRom(cart);
    }

    async function onSwitchActive(bankId: string): Promise<void> {
        if (bankId === activeBankId) return;
        const target = banks.find(b => b.id === bankId);
        if (!target) return;
        const running = isCurrentRom();
        const msg = running
            ? `Switch active save to "${target.name}"? The ROM will reset to load the new bank. Any SRAM changes since the last autosave on the current bank will be lost.`
            : `Switch active save to "${target.name}"?`;
        const ok = await requestConfirm({
            title: "Switch active battery save",
            message: msg,
            confirmLabel: "Switch",
            cancelLabel: "Cancel",
        });
        if (!ok) return;
        await setActiveBank(sha1, bankId);
        // Do not touch the in-memory cache here while the loop may still tick;
        // playRom() pauses first, then refreshes the cache from the DB.
        if (running) {
            await reloadIfCurrent();
        } else {
            setActiveBankCache(sha1, bankId);
        }
        showToast(`Active battery: "${target.name}"`, "info");
    }

    function onExport(bank: BankInfo): void {
        loadBank(sha1, bank.id).then(bytes => {
            if (!bytes) return;
            const link = document.createElement("a");
            const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
            link.href = URL.createObjectURL(blob);
            const safeBank = bank.name.replace(/[^a-z0-9-_]+/gi, "_");
            link.download = `${name}.${safeBank}.sav`;
            link.click();
            URL.revokeObjectURL(link.href);
        });
    }

    async function onReplace(e: Event, bank: BankInfo): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await writeBank(sha1, bank.id, bytes);
        input.value = "";
        showToast(`Replaced "${bank.name}".`, "info");
        if (bank.id === activeBankId) await reloadIfCurrent();
    }

    async function onImportAsNew(e: Event): Promise<void> {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const baseName = file.name.replace(/\.sav$/i, "");
        await writeBank(sha1, generateBankId(), bytes, baseName || "Imported");
        input.value = "";
        showToast(`Imported "${baseName}" as new bank.`, "info");
    }

    async function onNewEmpty(): Promise<void> {
        const sizeRef = banks[0]?.size ?? 8192;
        await writeBank(sha1, generateBankId(), new Uint8Array(sizeRef), "New bank");
        showToast("Created empty bank.", "info");
    }

    async function onDuplicate(bank: BankInfo): Promise<void> {
        await duplicateBank(sha1, bank.id, `${bank.name} (copy)`);
        showToast(`Duplicated "${bank.name}".`, "info");
    }

    function startRename(bank: BankInfo): void {
        renamingId = bank.id;
        renameValue = bank.name;
        renameCancelled = false;
    }

    async function commitRename(bank: BankInfo): Promise<void> {
        if (renameCancelled) { renameCancelled = false; return; }
        const v = renameValue.trim();
        renamingId = null;
        if (v && v !== bank.name) {
            await renameBank(sha1, bank.id, v);
        }
    }

    function cancelRename(): void {
        renameCancelled = true;
        renamingId = null;
    }

    async function onDelete(bank: BankInfo): Promise<void> {
        if (banks.length <= 1) {
            showToast("Cannot delete the only bank.", "error");
            return;
        }
        const ok = await requestConfirm({
            title: "Delete battery bank",
            message: `Permanently delete bank "${bank.name}"? This cannot be undone.`,
            confirmLabel: "Delete",
            cancelLabel: "Cancel",
        });
        if (!ok) return;
        const wasActive = bank.id === activeBankId;
        await deleteBank(sha1, bank.id);
        if (wasActive) {
            const next = banks.find(b => b.id !== bank.id);
            if (next) {
                await setActiveBank(sha1, next.id);
                if (isCurrentRom()) {
                    await reloadIfCurrent();
                } else {
                    setActiveBankCache(sha1, next.id);
                }
            }
        }
        showToast(`Deleted "${bank.name}".`, "info");
    }

    async function onRestoreFromRing(entry: BatteryRingEntry): Promise<void> {
        const target = banks.find(b => b.id === activeBankId);
        if (!target) return;
        const ok = await requestConfirm({
            title: "Restore auto-backup",
            message: `Overwrite active bank "${target.name}" with this auto-backup from ${fmt(entry.savedAt)}?`,
            confirmLabel: "Restore",
            cancelLabel: "Cancel",
        });
        if (!ok) return;
        await writeBank(sha1, activeBankId, entry.bytes);
        await reloadIfCurrent();
        showToast("Auto-backup restored to active bank.", "info");
    }

    onMount(() => { refresh(); });
</script>

<div class="banks-card">
    <header>
        <Icon name="battery" />
        <h3>Battery saves (SRAM)</h3>
    </header>

    {#if banks.length === 0}
        <p class="empty">No battery save yet. Will be captured automatically while you play.</p>
        <div class="row-actions">
            <label class="btn upload">
                <Icon name="cloud-arrow-up" /> Import .sav…
                <input type="file" accept=".sav,application/octet-stream" onchange={onImportAsNew} />
            </label>
            <button class="btn" onclick={onNewEmpty}>+ New empty bank</button>
        </div>
    {:else}
        <ul class="banks">
            {#each banks as bank (bank.id)}
                <li class="bank" class:active={bank.id === activeBankId}>
                    <label class="radio">
                        <input
                            type="radio"
                            name={`bank-${sha1}`}
                            checked={bank.id === activeBankId}
                            onchange={() => onSwitchActive(bank.id)}
                        />
                        <div class="info">
                            {#if renamingId === bank.id}
                                <input
                                    class="rename-input"
                                    type="text"
                                    bind:value={renameValue}
                                    onblur={() => commitRename(bank)}
                                    onkeydown={(e: KeyboardEvent) => {
                                        if (e.key === 'Enter') commitRename(bank);
                                        if (e.key === 'Escape') cancelRename();
                                    }}
                                />
                            {:else}
                                <span
                                    class="name"
                                    role="button"
                                    tabindex="0"
                                    title="Double-click or press Enter to rename"
                                    ondblclick={() => startRename(bank)}
                                    onkeydown={(e: KeyboardEvent) => {
                                        if (e.key === 'F2' || e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            startRename(bank);
                                        }
                                    }}
                                >{bank.name}</span>
                            {/if}
                            <span class="meta">{humanReadableSize(bank.size)} · {fmt(bank.savedAt)}</span>
                        </div>
                    </label>
                    <div class="row-actions">
                        <button class="btn icon-only" title="Export" onclick={() => onExport(bank)}><Icon name="cloud-arrow-down" /></button>
                        <label class="btn upload icon-only" title="Replace from .sav">
                            <Icon name="cloud-arrow-up" />
                            <input type="file" accept=".sav,application/octet-stream" onchange={(e: Event) => onReplace(e, bank)} />
                        </label>
                        <button class="btn icon-only" title="Duplicate" onclick={() => onDuplicate(bank)}>⎘</button>
                        <button class="btn icon-only" title="Rename" onclick={() => startRename(bank)}>✎</button>
                        <button class="btn icon-only danger" title="Delete" onclick={() => onDelete(bank)}><Icon name="trash" /></button>
                    </div>
                </li>
            {/each}
        </ul>

        <div class="row-actions create">
            <button class="btn" onclick={onNewEmpty}>+ New empty bank</button>
            <label class="btn upload">
                <Icon name="cloud-arrow-up" /> + Import .sav as new
                <input type="file" accept=".sav,application/octet-stream" onchange={onImportAsNew} />
            </label>
        </div>

        {#if ring.length > 0}
            <div class="ring">
                <button class="ring-toggle" onclick={() => (showRing = !showRing)}>
                    {showRing ? "▾" : "▸"} Auto-backup history ({ring.length})
                </button>
                {#if showRing}
                    <ul class="ring-list">
                        {#each ring as entry (entry.savedAt)}
                            <li>
                                <span class="meta">{fmt(entry.savedAt)} · {entry.sourceBank}</span>
                                <button class="btn small" onclick={() => onRestoreFromRing(entry)}>
                                    <Icon name="rotate" /> Restore→active
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .banks-card {
        background: #181825;
        border: 1px solid #45475a;
        border-radius: 4px;
        padding: 0.6em 0.75em;
        display: flex;
        flex-direction: column;
        gap: 0.6em;
    }
    header { display: flex; align-items: center; gap: 0.4em; }
    h3 { margin: 0; font-size: 0.95em; color: #cdd6f4; }
    .empty { margin: 0; font-style: italic; color: #888; font-size: 0.85em; }

    ul.banks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35em; }
    .bank {
        display: flex; align-items: center; justify-content: space-between; gap: 0.6em;
        padding: 0.4em 0.5em;
        background: #1e1e2e; border: 1px solid #313244; border-radius: 3px;
    }
    .bank.active { border-color: #89b4fa; background: #1e2030; }
    .radio { display: flex; align-items: center; gap: 0.5em; cursor: pointer; flex: 1; min-width: 0; }
    .radio input { margin: 0; }
    .info { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 0.9em; color: #cdd6f4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { font-size: 0.75em; color: #888; }
    .rename-input {
        background: #11111b; color: #cdd6f4;
        border: 1px solid #585b70; border-radius: 2px;
        padding: 0.1em 0.3em; font-size: 0.9em;
    }

    .row-actions { display: flex; gap: 0.3em; flex-wrap: wrap; }
    .row-actions.create { padding-top: 0.2em; border-top: 1px dashed #313244; }
    .btn {
        display: inline-flex; align-items: center; gap: 0.3em;
        padding: 0.3em 0.55em;
        background: #2a2a3a; border: 1px solid #45475a; border-radius: 3px;
        color: inherit; cursor: pointer; font-size: 0.85em;
    }
    .btn:hover { background: #34344a; }
    .btn.small { padding: 0.2em 0.45em; font-size: 0.8em; }
    .btn.icon-only { padding: 0.3em 0.45em; }
    .upload input { display: none; }
    .danger { color: #f38ba8; }
    .danger:hover { background: rgba(243, 139, 168, 0.12); }

    .ring { display: flex; flex-direction: column; gap: 0.3em; padding-top: 0.3em; border-top: 1px dashed #313244; }
    .ring-toggle {
        background: transparent; border: 0; color: #a6adc8;
        text-align: left; padding: 0.2em 0; font-size: 0.85em; cursor: pointer;
    }
    .ring-toggle:hover { color: #cdd6f4; }
    ul.ring-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25em; }
    ul.ring-list li { display: flex; justify-content: space-between; align-items: center; gap: 0.5em; font-size: 0.85em; }
</style>
