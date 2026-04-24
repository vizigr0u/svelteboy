<script lang="ts">
  import { onMount } from "svelte";
  import Player from "./lib/Player.svelte";
  import { Emulator } from "./emulator";
  import { parseRomParam } from "./utils";
  import { findStoredRomByName } from "./stores/idbStore";
  import type { RemoteRom } from "./types";

  onMount(async () => {
    const param = parseRomParam();
    if (!param) return;
    if (param.type === 'local') {
      const rom = await findStoredRomByName(param.name);
      if (rom) Emulator.PlayRom(rom);
    } else {
      const remoteRom: RemoteRom = { name: param.name, sha1: '', uri: param.uri };
      Emulator.PlayRom(remoteRom);
    }
  });
</script>

<div class="page-container">
  <main>
    <Player />
  </main>
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
</style>
