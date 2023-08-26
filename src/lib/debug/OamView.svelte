<script lang="ts">
    import { getOAMTiles } from "../../../build/release";
    import { GameFrames } from "../../stores/playStores";
    import type { OamEntry } from "../../types";

    let objects: OamEntry[] = [];

    let buffer: Uint32Array = new Uint32Array(40);
    let debug: string = "";

    GameFrames.subscribe((_) => {
        buffer = getOAMTiles(buffer);
        buffer.forEach((n, i) => {
            objects[i] = {
                posX: (n >> 24) & 0xff,
                posY: ((n & 0xff0000) >> 16) & 0xff,
                tileIndex: ((n & 0xff00) >> 8) & 0xff,
                behindBG: true,
                xFlip: false,
                yFlip: false,
            };
        });
    });
</script>

<span>{debug}</span>
<div class="debug-tool-container">
    <h3 class="oam-entries-title">OAM entries</h3>
    <div class="oam-entries">
        {#each objects as o, i}
            <div class="oam-entry">
                <span class="oam-index">#{i}</span>
                <span class="oam-pos">({o.posX}, {o.posY})</span>
                <span class="oam-tile-index">tile index: {o.tileIndex}</span>
                <span class="oam-over-bg"
                    >over BG: <input
                        type="checkbox"
                        checked={!o.behindBG}
                        disabled={true}
                    /></span
                >
                <span class="oam-flip"
                    >flip x <input
                        type="checkbox"
                        checked={o.xFlip}
                        disabled={true}
                    />
                    y
                    <input type="checkbox" checked={o.yFlip} disabled={true} />
                </span>
            </div>
        {/each}
    </div>
</div>

<style>
    .oam-entries-title {
        font-size: 1.3em;
        text-align: center;
        margin-bottom: 0.5em;
    }

    .oam-entries {
        display: flex;
        flex-direction: column;
        max-height: 25em;
        overflow-y: auto;
    }

    .oam-entry {
        display: grid;
        grid-template-columns: 2.8em 5.5em 8em 5.5em 6em /*repeat(auto-fill, 6em)*/;
    }

    .oam-index {
        color: #999;
    }

    .oam-flip {
        display: flex;
        align-items: center;
        justify-content: right;
        gap: 0.4em;
    }
</style>
