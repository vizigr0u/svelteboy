<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";
  import Player from "./lib/Player.svelte";
  import { Emulator } from "./emulator";
  import { parseRomParam } from "./utils";
  import {
    libraryHydrated,
    findLibraryRomBySha1,
    findLibraryRomByName,
    findLibraryRomByUri,
  } from "./stores/libraryStore";
  import type { LibraryRom } from "./types";

  function waitForLibrary(): Promise<void> {
    return new Promise((resolve) => {
      if (get(libraryHydrated)) return resolve();
      const unsub = libraryHydrated.subscribe((h) => {
        if (h) {
          unsub();
          resolve();
        }
      });
    });
  }

  onMount(async () => {
    const param = parseRomParam();
    if (!param) return;
    await waitForLibrary();

    if (param.kind === "sha1") {
      const rom = await findLibraryRomBySha1(param.sha1);
      if (rom) Emulator.PlayRom(rom);
      return;
    }
    if (param.kind === "uri") {
      const matched = await findLibraryRomByUri(param.uri);
      if (matched) {
        Emulator.PlayRom(matched);
        return;
      }
      const ephemeral: LibraryRom = {
        name: param.name,
        sha1: "uri:ephemeral",
        source: { kind: "uri", uri: param.uri },
        addedAt: Date.now(),
        originUri: param.uri,
      };
      Emulator.PlayRom(ephemeral);
      return;
    }
    const byName = await findLibraryRomByName(param.name);
    if (byName) Emulator.PlayRom(byName);
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
