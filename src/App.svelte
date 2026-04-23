<script lang="ts">
  import DebugSection from "./lib/debug/DebugSection.svelte";
  import Player from "./lib/Player.svelte";
  import { ShowDebugger } from "./stores/optionsStore";
</script>

<div class="page-container">
  <main>
    <Player />
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
