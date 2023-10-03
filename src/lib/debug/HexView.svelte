<script lang="ts">
    export let dataArray: Uint8Array;
    export let startPC: number = 0;

    function numLines(): number {
        return Math.ceil((dataArray.length + (startPC & 0xf)) / 16);
    }

    function getLinePC(index: number): number {
        const firstLinePC = startPC & 0xfff0;
        return firstLinePC + index * 16;
    }

    function getValue(line: number, column: number): number {
        const gridIndex = column + line * 16;
        const offset = startPC & 0xf;
        if (gridIndex < offset || gridIndex - offset >= dataArray.length)
            return -1;
        return dataArray[gridIndex - offset];
    }
</script>

<div class="hex-viewer-grid">
    fetched data: {dataArray.byteLength} Bytes.
    <div class="hex-viewer__content">
        <div />
        {#each Array(16) as _, x (x)}
            <div class="hex-viewer__header-number">
                {x.toString(16).padStart(2, "0")}
            </div>
        {/each}
        {#each Array(numLines()) as _, i (i)}
            <div class="hex-viewer__line-number">
                0x{getLinePC(i).toString(16).padStart(4, "0")}
            </div>
            {#each Array(16) as _, x (x)}
                {@const value = getValue(i, x)}
                <div class="hexviewer-number" class:zerod={value === 0}>
                    {value === -1 ? "  " : value.toString(16).padStart(2, "0")}
                </div>
            {/each}
        {/each}
    </div>
</div>

<style>
    .hex-viewer__content {
        max-height: 15em;
        overflow-y: auto;
        display: grid;
        grid-template-columns: 4em repeat(16, 2em);
    }

    .hex-viewer__header-number,
    .hex-viewer__line-number {
        color: #999;
        background-color: var(--subsection-bg-color);
    }

    .hexviewer-number {
        border: 1px solid var(--text-faded-color);
        border-left-width: 0;
        border-top-width: 0;
    }

    .zerod {
        color: #888;
    }
</style>
