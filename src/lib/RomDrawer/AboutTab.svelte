<script lang="ts">
    import type { LibraryRom } from "../../types";
    import { prefsForRom, setPrefsFor } from "stores/romStores";
    import { humanReadableSize } from "../../utils";
    import { showToast } from "stores/toastStore";

    let { rom } = $props<{ rom: LibraryRom }>();
    let prefs = $derived(prefsForRom(rom.sha1));
    let pendingNotes = $state('');
    $effect(() => {
        pendingNotes = $prefs.notes ?? '';
    });
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    function onNotesInput(e: Event) {
        pendingNotes = (e.target as HTMLTextAreaElement).value;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            setPrefsFor(rom.sha1, { notes: pendingNotes });
            showToast('Saved notes.', 'info');
        }, 600);
    }

    function fmtDate(ts?: number): string {
        return ts ? new Date(ts).toLocaleString() : '—';
    }
</script>

<div class="about-tab">
    <dl>
        <dt>SHA-1</dt><dd class="mono">{rom.sha1}</dd>
        <dt>Filename</dt><dd>{rom.name}</dd>
        <dt>File size</dt><dd>{rom.fileSize !== undefined ? humanReadableSize(rom.fileSize) : '—'}</dd>
        {#if rom.mbcKind && rom.mbcKind !== 'none'}
            <dt>Bank controller</dt><dd>{rom.mbcKind.toUpperCase()}</dd>
        {/if}
        {#if rom.romBankCount !== undefined}
            <dt>ROM banks</dt><dd>{rom.romBankCount}</dd>
        {/if}
        {#if rom.ramBankCount !== undefined && rom.ramBankCount > 0}
            <dt>RAM banks</dt><dd>{rom.ramBankCount} ({humanReadableSize(rom.ramSize ?? 0)})</dd>
        {/if}
        {#if rom.originUri}
            <dt>Origin</dt><dd class="break"><a href={rom.originUri} target="_blank" rel="noreferrer noopener">{rom.originUri}</a></dd>
        {/if}
        <dt>Added</dt><dd>{fmtDate(rom.addedAt)}</dd>
        <dt>Last played</dt><dd>{fmtDate(rom.lastPlayedAt)}</dd>
        <dt>Cart type byte</dt><dd class="mono">{rom.cartridgeType !== undefined ? '0x' + rom.cartridgeType.toString(16).padStart(2, '0') : '—'}</dd>
        <dt>hasBattery</dt><dd>{String(rom.hasBattery)}</dd>
        <dt>hasRtc</dt><dd>{String(rom.hasRtc)}</dd>
        <dt>hasRumble</dt><dd>{String(rom.hasRumble)}</dd>
    </dl>

    <section>
        <h3>Notes</h3>
        <textarea
            rows="4"
            value={pendingNotes}
            placeholder="Personal notes about this game (saved automatically)…"
            oninput={onNotesInput}
        ></textarea>
    </section>
</div>

<style>
    .about-tab { display: flex; flex-direction: column; gap: 0.75em; font-size: 0.9em; }
    dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.3em 0.8em;
        margin: 0;
    }
    dt { color: var(--muted-color); }
    dd { margin: 0; word-break: break-word; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .break { word-break: break-all; }
    section { display: flex; flex-direction: column; gap: 0.3em; }
    h3 { margin: 0; font-size: 0.9em; color: var(--text-color); }
    textarea {
        width: 100%;
        background: #1a1a26;
        color: var(--text-color);
        border: 1px solid var(--border-color);
        border-radius: 3px;
        padding: 0.4em;
        font-family: inherit;
        font-size: 0.9em;
        resize: vertical;
    }
</style>
