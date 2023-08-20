<script lang="ts">
    import { GbDebugInfoStore } from "../../stores/debugStores";
    import { PPUMode } from "../../types";
    import { uToHex, uToHex16 } from "../../utils";
    import CpuFlagsView from "./CpuFlagsView.svelte";
    import DebuggerLine from "./DebuggerLine.svelte";
    import RegisterView from "./RegisterView.svelte";
</script>

<div class="cpu-debug-info debug-tool-container">
    {#if $GbDebugInfoStore == undefined}
        Start debugging to see debug info.
    {:else}
        <div>
            Next Instruction:
            <DebuggerLine line={$GbDebugInfoStore.nextInstruction} />
        </div>
        <div class="debug-info-blocks">
            <div class="registers-info">
                <RegisterView
                    name="PC"
                    value={$GbDebugInfoStore.registers.PC}
                />
                <RegisterView
                    name="SP"
                    value={$GbDebugInfoStore.registers.SP}
                />
                <div class="gap" />
                <RegisterView
                    name="AF"
                    value={$GbDebugInfoStore.registers.AF}
                />
                <RegisterView
                    name="BC"
                    value={$GbDebugInfoStore.registers.BC}
                />
                <RegisterView
                    name="DE"
                    value={$GbDebugInfoStore.registers.DE}
                />
                <RegisterView
                    name="HL"
                    value={$GbDebugInfoStore.registers.HL}
                />
                <div class="gap" />
                <CpuFlagsView flags={$GbDebugInfoStore.registers.AF} />
                <div class="cpu-flags-info" />
            </div>
            <div class="lcd-info">
                <span>control: {$GbDebugInfoStore.lcd.control}</span>
                <span>stat: {$GbDebugInfoStore.lcd.stat}</span>
                <span>scY: {$GbDebugInfoStore.lcd.scY}</span>
                <span>scX: {$GbDebugInfoStore.lcd.scX}</span>
                <span>lY: {$GbDebugInfoStore.lcd.lY}</span>
                <span>lYcompare: {$GbDebugInfoStore.lcd.lYcompare}</span>
                <span>dma: {$GbDebugInfoStore.lcd.dma}</span>
                <div class="gap" />
                <span>Frame: {$GbDebugInfoStore.currentFrame}</span>
                <span
                    >PPU mode: {PPUMode[
                        $GbDebugInfoStore.ppu.currentMode
                    ]}</span
                >
                <span>PPU current dot: {$GbDebugInfoStore.ppu.currentDot}</span>
            </div>
            <div class="other-info">
                <div class="info-field">
                    Cycle Count: {$GbDebugInfoStore.cycleCount}
                </div>
                <div class="info-field">
                    Use boot rom: <input
                        type="checkbox"
                        checked={$GbDebugInfoStore.useBootRom}
                        disabled={true}
                    />
                </div>
                <div class="info-field">
                    Halted:
                    <input
                        type="checkbox"
                        checked={$GbDebugInfoStore.isHalted}
                        disabled={true}
                    />
                </div>
                <div class="info-field">
                    Stopped:
                    <input
                        type="checkbox"
                        checked={$GbDebugInfoStore.isStopped}
                        disabled={true}
                    />
                </div>
                <div class="info-field">
                    IME <input
                        type="checkbox"
                        checked={$GbDebugInfoStore.interruptsMaster}
                        disabled={true}
                    />
                </div>
                <div class="info-field">
                    IF {uToHex($GbDebugInfoStore.interruptFlags)}
                </div>
                <div class="info-field">
                    IE {uToHex($GbDebugInfoStore.interruptEnabled)}
                </div>
                <div class="gap" />
                <div class="info-field">
                    Div: {uToHex($GbDebugInfoStore.timer.div)}
                    ({uToHex16($GbDebugInfoStore.timer.internalDiv)})
                </div>
                <div class="info-field">
                    Tima: {uToHex($GbDebugInfoStore.timer.tima)}
                </div>
                <div class="info-field">
                    Tma: {uToHex($GbDebugInfoStore.timer.tma)}
                </div>
                <div class="info-field">
                    Tac: {uToHex($GbDebugInfoStore.timer.tac)}
                </div>
            </div>
        </div>
        <div class="info-field">
            Serial:
            <div class="serial-content">
                {$GbDebugInfoStore.serialBuffer == ""
                    ? "(empty)"
                    : $GbDebugInfoStore.serialBuffer}
            </div>
        </div>
    {/if}
</div>

<style>
    .cpu-debug-info {
        display: flex;
        flex-direction: column;
        flex-wrap: wrap;
        justify-content: space-around;
        margin: 2em 0;
    }

    .debug-info-blocks {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        text-align: left;
    }

    .gap {
        height: 1em;
    }

    .lcd-info {
        display: flex;
        flex-direction: column;
    }

    .other-info {
        text-align: left;
    }

    .serial-content {
        font-family: "Courier New", Courier, monospace;
        padding: 0.2em;
        background-color: #282828;
        border: 1px solid #444;
        min-width: 20em;
        min-height: 4em;
        max-height: 8em;
        overflow-y: auto;
    }
</style>
