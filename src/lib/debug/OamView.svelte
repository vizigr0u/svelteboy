<script lang="ts">
    import { getOAMTiles } from "../../../build/release";
    import { GameFrames } from "../../stores/playStores";
    import type { OamEntry } from "../../types";

    let objects: OamEntry[] = [];

    let buffer: Uint32Array = new Uint32Array(40);
    let debug: string = "";

    enum OamAttribute {
        /* 0-2: CGB pal number */
        /* CGB only TileBank = 3, */
        PaletteNumber = 4,
        XFlip = 5,
        YFlip = 6,
        BGandWindowOver = 7,
    }

    GameFrames.subscribe((frameNumber) => {
        if (frameNumber == 0) return;
        buffer = getOAMTiles(buffer);
        buffer.forEach((n, i) => {
            const flags = (n >> 24) & 0xff;
            objects[i] = {
                posY: n & 0xff,
                posX: ((n & 0xff00) >> 8) & 0xff,
                tileIndex: ((n & 0xff0000) >> 16) & 0xff,
                behindBG: (flags & OamAttribute.BGandWindowOver) != 0,
                xFlip: (flags & OamAttribute.XFlip) != 0,
                yFlip: (flags & OamAttribute.YFlip) != 0,
            };
            objects = objects;
        });
    });
</script>

<span>{debug}</span>
<div class="debug-tool-container">
    <h3 class="oam-entries-title">OAM entries</h3>
    <div class="oam-entries">
        <div class="oam-line oam-line-header">
            <span>#</span>
            <span>pos</span>
            <span>tileIndex</span>
            <span>Behind BG</span>
            <span>Flip</span>
        </div>
        {#each objects as o, i}
            <div class="oam-line" class:line-disabled={o.posX == 0}>
                <span class="oam-index">
                    <span class="oam-u32">
                        uint32: {buffer[i].toString(16)}
                    </span>
                    #{i}
                </span>
                <span class="oam-pos">({o.posX - 8}, {o.posY - 16})</span>
                <span class="oam-tile-index">{o.tileIndex}</span>
                <input type="checkbox" checked={o.behindBG} disabled={true} />
                <span class="oam-flip"
                    >x <input
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
        gap: 0.1em;
    }

    .oam-line {
        position: relative;
        display: grid;
        grid-template-columns: 2.8em repeat(auto-fill, 6em);
    }

    .line-disabled {
        color: #999;
    }

    .oam-line-header {
        font-weight: 600;
    }

    .oam-u32 {
        position: absolute;
        /* top: -5em; */
        left: 2em;
        color: black;
        background-color: aliceblue;
        visibility: hidden;
    }

    .oam-index:hover .oam-u32 {
        visibility: visible;
    }

    .oam-index {
        color: #999;
    }

    .oam-line > input[type="checkbox"] {
        margin-right: auto;
    }

    .oam-flip {
        display: flex;
        align-items: center;
        gap: 0.4em;
    }
</style>
