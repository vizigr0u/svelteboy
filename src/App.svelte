<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import GbScreenCanvas from "./lib/GbScreenCanvas.svelte";
  import RomLoader from "./lib/RomLoader.svelte";
  import { RomType } from "./types";
</script>

<div class="page-container">
  <main>
    <GbScreenCanvas />
    <div class="rom-loaders">
      <RomLoader romType={RomType.Boot} title="Boot roms" />
      <RomLoader romType={RomType.Cartridge} title="Cartridge roms" />
    </div>
  </main>
  <aside>
    <DebugSection />
  </aside>
</div>

<style>
  .page-container {
    width: 100%;
    display: flex;
    justify-content: space-around;
  }

  .rom-loaders {
    display: flex;
  }
</style>
