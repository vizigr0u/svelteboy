<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import OptionsView from "./lib/OptionsView.svelte";
  import Player from "./lib/Player.svelte";
  import RomList from "./lib/RomList.svelte";
  import { RomType } from "./types";
</script>

<div class="page-container">
  <main>
    <Player />
    <RomList romType={RomType.Cartridge} title="Cartridge roms" />
    <OptionsView />
    <RomList romType={RomType.Boot} title="Boot roms" />
    <div class="rom-loaders" />
  </main>
  <aside>
    <DebugSection />
  </aside>
</div>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2em;
  }
  .page-container {
    width: 100%;
    display: flex;
    justify-content: left;
    gap: 2em;
  }

  .rom-loaders {
    display: flex;
    gap: 2em;
    flex-direction: column;
  }
</style>
