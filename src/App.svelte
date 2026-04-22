<script lang="ts">
  import Player from "./lib/Player.svelte";
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
