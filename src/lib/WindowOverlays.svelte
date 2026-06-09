<script lang="ts">
    import Window from "./Window.svelte";
    import WindowSkeleton from "./WindowSkeleton.svelte";
    import SavesViewer from "./SavesViewer.svelte";
    import OptionsView from "./OptionsView.svelte";
    import BindingsView from "./BindingsView.svelte";
    import AboutView from "./AboutView.svelte";
    import {
        showSavesWindow,
        showOptionsWindow,
        showBindingsWindow,
        showDebugWindow,
        showAboutWindow,
    } from "../stores/windowStores";

    let DebugSection: any = $state(null);

    $effect(() => {
        if ($showDebugWindow && !DebugSection) {
            import("./debug/DebugSection.svelte").then(m => DebugSection = m.default);
        }
    });
</script>

{#if $showSavesWindow}
    <Window title="Saves" onclose={() => showSavesWindow.set(false)}>
        <SavesViewer />
    </Window>
{/if}
{#if $showOptionsWindow}
    <Window title="Options" onclose={() => showOptionsWindow.set(false)}>
        <OptionsView />
    </Window>
{/if}
{#if $showBindingsWindow}
    <Window title="Keyboard Bindings" onclose={() => showBindingsWindow.set(false)}>
        <BindingsView />
    </Window>
{/if}
{#if $showAboutWindow}
    <Window title="About SvelteBoy" onclose={() => showAboutWindow.set(false)}>
        <AboutView />
    </Window>
{/if}
{#if $showDebugWindow}
    <Window title="Debug" onclose={() => showDebugWindow.set(false)} wide>
        {#if DebugSection}
            <DebugSection />
        {:else}
            <WindowSkeleton label="Loading debug tools…" />
        {/if}
    </Window>
{/if}
