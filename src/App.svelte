<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import Player from "./lib/Player.svelte";
  import RomList from "./lib/RomList.svelte";
  import { RomType } from "./types";
</script>

<div class="page-container">
  <main>
    <Player />
    <div class="rom-loaders">
      <RomList romType={RomType.Boot} title="Boot roms" />
      <RomList romType={RomType.Cartridge} title="Cartridge roms" />
    </div>
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
    justify-content: space-around;
    gap: 2em;
  }

  .rom-loaders {
    display: flex;
    gap: 2em;
    flex-direction: column;
  }
</style>
