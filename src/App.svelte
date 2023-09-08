<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import OptionsView from "./lib/OptionsView.svelte";
  import Player from "./lib/Player.svelte";
  import RomDropZone from "./lib/RomDropZone.svelte";
  import RomList from "./lib/RomList.svelte";
  import SavesViewer from "./lib/SavesViewer.svelte";
  import { RemoteRomsListUri } from "./stores/optionsStore";
  import { cartRomStore } from "./stores/romStores";
  import type { RemoteRom, RemoteRomsList, RomReference } from "./types";

  let remotePromise: Promise<RemoteRom[]> = new Promise<RemoteRom[]>((r) =>
    r([])
  );
  let localPromise = new Promise<RomReference[]>((r) => {
    r($cartRomStore);
  });

  RemoteRomsListUri.subscribe((uri) => {
    if (uri && uri.startsWith("http")) {
      remotePromise = getList(uri);
    } else {
      remotePromise = new Promise<RemoteRom[]>((r) => r([]));
    }
  });

  async function getList(uri): Promise<RemoteRom[]> {
    const res = await fetch(uri);
    const list = (await res.json()) as RemoteRomsList;
    const roms: RemoteRom[] = list.roms.map((r) => {
      const a: RemoteRom = {
        name: r.filename,
        sha1: r.sha1,
        uri: list.baseuri + r.location + "/" + r.filename,
      };
      return a;
    });
    return roms;
  }
</script>

<div class="page-container">
  <main>
    <Player />
    <SavesViewer />
    <RomList
      title="Hosted roms"
      romsPromise={remotePromise}
      loadingListText="Fetching {$RemoteRomsListUri}..."
    />
    <RomDropZone>
      <RomList
        title="Local roms"
        romsPromise={localPromise}
        loadingListText="Fetching local list..."
      />
    </RomDropZone>
    <OptionsView />
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
</style>
