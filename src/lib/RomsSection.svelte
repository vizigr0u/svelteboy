<script lang="ts">
    import {
        FetchingRemoteRoms,
        RemoteRomsListUri,
        CachedRemoteRoms,
    } from "@/stores/optionsStore";
    import { cartRomStore } from "@/stores/romStores";
    import { DragState, type RemoteRom } from "../types";
    import RomDropZone from "./RomDropZone.svelte";
    import RomList from "./RomList.svelte";
    import HomeBrewList from "../assets/homebrews";

    let dragState: DragState;
    let dragStatus: string;

    enum Tab {
        Homebrews,
        Local,
        Hosted,
    }
    const homebrews: RemoteRom[] = HomeBrewList;
    console.log("Homebrews: " + JSON.stringify(homebrews));

    let tab: Tab = Tab.Local;

    let tabOptions = [Tab.Local, Tab.Hosted];
</script>

<RomDropZone bind:dragState bind:dragStatus>
    <div
        class="dropzone-hint"
        class:drop-allowed={dragState == DragState.Accept}
        class:drop-disallowed={dragState == DragState.Reject}
    >
        <p>
            Drop your rom files here
            <span>{dragStatus}</span>
        </p>
        <div>
            {#each tabOptions as tabOption}
                <button
                    on:click={() => (tab = tabOption)}
                    disabled={tab == tabOption}>{Tab[tabOption]}</button
                >
            {/each}
        </div>
        {#if tab == Tab.Local}
            <RomList title="Local roms" roms={$cartRomStore} />
        {:else if tab == Tab.Homebrews}
            <RomList title="Local roms" roms={homebrews} />
        {:else if $FetchingRemoteRoms}
            <span class="loading-roms-text"
                ><i class="fas fa-spinner fa-spin" /> Fetching {$RemoteRomsListUri}...</span
            >
        {:else}
            <RomList title="Hosted roms" roms={$CachedRemoteRoms} />
        {/if}
    </div>
</RomDropZone>

<style>
    .dropzone-hint {
        margin: 0.5em;
        padding: 0.5em;
        background-color: #222;
        border: 2px solid #111;
        display: flex;
        flex-direction: column;
    }

    .dropzone-hint.drop-allowed {
        border-color: greenyellow;
    }

    .dropzone-hint.drop-disallowed {
        border-color: red;
    }
</style>
