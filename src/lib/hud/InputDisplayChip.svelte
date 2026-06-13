<script lang="ts">
    import { KeyPressMap } from "stores/playStores";
    import { InputType } from "../../types";

    const dirs: { input: InputType; label: string; area: string }[] = [
        { input: InputType.Up,    label: '▲', area: 'U' },
        { input: InputType.Left,  label: '◀', area: 'L' },
        { input: InputType.Right, label: '▶', area: 'R' },
        { input: InputType.Down,  label: '▼', area: 'D' },
    ];
    const buttons: { input: InputType; label: string }[] = [
        { input: InputType.Select, label: 'SEL' },
        { input: InputType.Start,  label: 'STA' },
        { input: InputType.B,      label: 'B' },
        { input: InputType.A,      label: 'A' },
    ];

    function pressed(set: Set<InputType>, i: InputType): boolean { return set.has(i); }
</script>

<div class="hud-chip hud-input-chip" title="Input state">
    <div class="hud-dpad">
        {#each dirs as d}
            <span class="hud-dpad-btn area-{d.area}" class:on={pressed($KeyPressMap, d.input)}>{d.label}</span>
        {/each}
    </div>
    <div class="hud-buttons">
        {#each buttons as b}
            <span class="hud-mini-btn" class:on={pressed($KeyPressMap, b.input)}>{b.label}</span>
        {/each}
    </div>
</div>

<style>
    .hud-input-chip {
        gap: 6px;
        align-items: center;
    }
    .hud-dpad {
        display: grid;
        grid-template-columns: repeat(3, 8px);
        grid-template-rows: repeat(3, 8px);
        grid-template-areas:
            ". U ."
            "L . R"
            ". D .";
        gap: 1px;
    }
    .hud-dpad-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 6px;
        line-height: 1;
        color: rgba(255,255,255,0.45);
        background: var(--tint-2);
        border-radius: 1px;
    }
    .hud-dpad-btn.on {
        background: var(--highlight-color);
        color: var(--background-color);
    }
    .area-U { grid-area: U; }
    .area-D { grid-area: D; }
    .area-L { grid-area: L; }
    .area-R { grid-area: R; }
    .hud-buttons { display: inline-flex; gap: 3px; }
    .hud-mini-btn {
        font-size: 9px;
        line-height: 1;
        padding: 2px 3px;
        background: var(--tint-2);
        color: rgba(255,255,255,0.5);
        border-radius: 2px;
        font-family: monospace;
        letter-spacing: 0;
    }
    .hud-mini-btn.on {
        background: var(--highlight-color);
        color: var(--background-color);
    }
</style>
