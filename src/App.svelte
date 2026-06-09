<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import Player from "./lib/Player.svelte";
  import HomeHub from "./lib/HomeHub.svelte";
  import WindowOverlays from "./lib/WindowOverlays.svelte";
  import ConfirmDialog from "./lib/ConfirmDialog.svelte";
  import Toaster from "./lib/Toaster.svelte";
  import Motd from "./lib/Motd.svelte";
  import AudioStatusNotice from "./lib/AudioStatusNotice.svelte";
  import RomDrawer from "./lib/RomDrawer.svelte";
  import { Emulator } from "./emulator";
  import { parseRomParam } from "./utils";
  import { playViewActive } from "./stores/viewStore";
  import { loadedCartridge, loadedBootRom } from "./stores/romStores";
  import {
    libraryHydrated,
    findLibraryRomBySha1,
    findLibraryRomByName,
    findLibraryRomByUri,
  } from "./stores/libraryStore";
  import { selectedRomSha1 } from "./stores/windowStores";
  import type { LibraryRom } from "./types";

  const SHA1_HEX = /^[a-f0-9]{40}$/i;

  function readSha1FromHash(): string | undefined {
    const h = window.location.hash;
    const m = h.match(/(?:^|[&#])rom=([^&]+)/);
    if (!m) return undefined;
    const v = decodeURIComponent(m[1]);
    return SHA1_HEX.test(v) ? v.toLowerCase() : undefined;
  }

  function writeSha1ToHash(sha1: string | undefined) {
    const current = readSha1FromHash();
    if (current === sha1) return;
    if (!sha1) {
      if (window.location.hash.startsWith("#rom=")) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#rom=${sha1}`);
  }

  function onHashChange() {
    const s = readSha1FromHash();
    if (s !== get(selectedRomSha1)) selectedRomSha1.set(s);
  }

  const unsubSelected = selectedRomSha1.subscribe((v) => writeSha1ToHash(v));

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
    window.addEventListener("hashchange", onHashChange);
    const initial = readSha1FromHash();
    if (initial) selectedRomSha1.set(initial);
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

  onDestroy(() => {
    window.removeEventListener("hashchange", onHashChange);
    unsubSelected();
  });
</script>

<AudioStatusNotice />
<Motd />
{#if $playViewActive && ($loadedCartridge || $loadedBootRom)}
  <Player />
{:else}
  <HomeHub />
{/if}
<WindowOverlays />
<RomDrawer />
<ConfirmDialog />
<Toaster />

<style>
</style>
