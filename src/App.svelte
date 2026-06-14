<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { get } from "svelte/store";
  import Player from "./lib/Player.svelte";
  import HomeHub from "./lib/HomeHub.svelte";
  import ConfirmDialog from "./lib/ConfirmDialog.svelte";
  import Toaster from "./lib/Toaster.svelte";
  import Motd from "./lib/Motd.svelte";
  import AudioStatusNotice from "./lib/AudioStatusNotice.svelte";
  import SettingsDrawer from "./lib/SettingsDrawer.svelte";
  import RomContextMenu from "./lib/RomContextMenu.svelte";
  import CommandPalette from "./lib/CommandPalette.svelte";
  import { Emulator } from "./emulator";
  import { parseRomParam } from "./utils";
  import { playViewActive, goToHome } from "./stores/viewStore";
  import { drawerOpen, closeDrawer } from "./stores/playUiStore";
  import { loadedCartridge, loadedBootRom } from "./stores/romStores";
  import {
    libraryHydrated,
    findLibraryRomBySha1,
    findLibraryRomByName,
    findLibraryRomByUri,
  } from "./stores/libraryStore";
  import { togglePalette, debugUnlocked } from "./stores/paletteStore";
  import type { LibraryRom } from "./types";

  const SHA1_HEX = /^[a-f0-9]{40}$/i;

  // #rom=<sha1> deep link plays directly (the details drawer is retired).
  function readSha1FromHash(): string | undefined {
    const h = window.location.hash;
    const m = h.match(/(?:^|[&#])rom=([^&]+)/);
    if (!m) return undefined;
    const v = decodeURIComponent(m[1]);
    return SHA1_HEX.test(v) ? v.toLowerCase() : undefined;
  }

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

  function onPaletteHotkey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopPropagation();
      togglePalette();
    }
  }

  function maybeUnlockDebugFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "1") return;
    debugUnlocked.set(true);
    params.delete("debug");
    const qs = params.toString();
    const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    history.replaceState(null, "", newUrl);
  }

  // Browser back: 1) close drawer, 2) leave Play for HomeHub, 3) let browser handle.
  // A single sentinel entry sits on top of history; we re-push it after each intercept.
  function onPopState() {
    if (get(drawerOpen)) {
      closeDrawer();
      history.pushState({ sb: 1 }, "");
      return;
    }
    if (get(playViewActive)) {
      goToHome();
      history.pushState({ sb: 1 }, "");
      return;
    }
    // Nothing to dismiss: allow the navigation to proceed (browser leaves the app).
  }

  onMount(async () => {
    window.addEventListener("keydown", onPaletteHotkey, true);
    window.addEventListener("popstate", onPopState);
    history.pushState({ sb: 1 }, "");
    maybeUnlockDebugFromQuery();
    const param = parseRomParam();
    const hashSha1 = readSha1FromHash();
    if (!param && hashSha1) {
      await waitForLibrary();
      const rom = await findLibraryRomBySha1(hashSha1);
      if (rom) Emulator.PlayRom(rom);
      return;
    }
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
    window.removeEventListener("keydown", onPaletteHotkey, true);
    window.removeEventListener("popstate", onPopState);
  });
</script>

<AudioStatusNotice />
<Motd />
{#if $playViewActive && ($loadedCartridge || $loadedBootRom)}
  <Player />
{:else}
  <HomeHub />
{/if}
<SettingsDrawer />
<RomContextMenu />
<CommandPalette />
<ConfirmDialog />
<Toaster />

<style>
</style>
