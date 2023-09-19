<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import OptionsView from "./lib/OptionsView.svelte";
  import Player from "./lib/Player.svelte";
  import SavesViewer from "./lib/SavesViewer.svelte";

  import RomsSection from "./lib/RomsSection.svelte";
  import { ShowDebugger } from "./stores/optionsStore";
  import AudioTests from "./lib/debug/AudioTests.svelte";
</script>

<div class="page-container">
  <main>
    <Player />
    <SavesViewer />

    <RomsSection />

    <OptionsView />
  </main>
  {#if $ShowDebugger}
    <aside>
      <DebugSection />
    </aside>
  {/if}
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
