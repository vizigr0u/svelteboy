<script lang="ts">
    import type { LibraryRom } from "../../types";
    import { prefsForRom } from "stores/romStores";
    import SaveSlotGrid from "./SaveSlotGrid.svelte";
    import BatterySaveBanks from "./BatterySaveBanks.svelte";

    let { rom } = $props<{ rom: LibraryRom }>();
    let prefs = $derived(prefsForRom(rom.sha1));
    let slotCount = $derived($prefs.quickSaveSlotCount ?? 4);
</script>

<div class="saves-tab">
    <section>
        <h3>Quick saves</h3>
        <SaveSlotGrid sha1={rom.sha1} name={rom.name} {slotCount} />
    </section>
    <section>
        <BatterySaveBanks sha1={rom.sha1} name={rom.name} />
    </section>
</div>

<style>
    .saves-tab { display: flex; flex-direction: column; gap: 1em; }
    section { display: flex; flex-direction: column; gap: 0.3em; }
    h3 { margin: 0; font-size: 1em; color: #cdd6f4; }
</style>
