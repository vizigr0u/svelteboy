<script lang="ts">
  import { bootRomStore, cartRomStore } from "../stores/romStores";
  import { RomType, type StoredRom } from "../types";
  import { humanReadableSize } from "../utils";

  export let romType: RomType;

  enum DragState {
    Idle,
    Accept,
    Reject,
  }

  const defaultDragText: string = `drop ${RomType[romType]} roms here`;
  const validFileExtensions: string[] =
    romType == RomType.Boot ? ["bin"] : ["gb", "gbc"];

  const romStore = romType == RomType.Boot ? bootRomStore : cartRomStore;

  let dragState: DragState = DragState.Idle;
  let dragZone: HTMLDivElement;
  let dragZoneText: string = defaultDragText;

  function getValidDroppedFileItem(e: DragEvent): DataTransferItem {
    if (e.dataTransfer.items.length != 1) return undefined;
    if (e.dataTransfer.items[0].kind != "file") return undefined;
    return e.dataTransfer.items[0];
  }

  function processDroppedFile(file: File) {
    const ext = file.name.split(".").pop();
    dragZoneText = `dropped file:
        ${file.name}
      size: ${humanReadableSize(file.size)}`;
    if (!validFileExtensions.includes(ext)) {
      dragZoneText += ": Unknown file type";
      return;
    }
    file.arrayBuffer().then((content) => {
      const newRom: StoredRom = {
        filename: file.name,
        contentBase64: Buffer.from(content).toString("base64"),
        uuid: crypto.randomUUID(),
        romType: romType,
        fileSize: file.size,
      };
      romStore.update((store) => [newRom, ...store]);
      dragState = DragState.Idle;
      dragZoneText = "";
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    let file = getValidDroppedFileItem(e)?.getAsFile();
    if (file != undefined) {
      processDroppedFile(file);
    } else {
      dragZoneText = "Ignored dropped item(s)";
    }
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
  }
  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragState = getValidDroppedFileItem(e)
      ? DragState.Accept
      : DragState.Reject;
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    dragState = DragState.Idle;
  }
</script>

<div
  bind:this={dragZone}
  role="none"
  class="dragZone text"
  class:allowed={dragState == DragState.Accept}
  class:disallowed={dragState == DragState.Reject}
  on:drop={onDrop}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:dragenter={onDragEnter}
>
  <slot />
  <div class="drag-status">{dragZoneText}</div>
</div>

<style>
  .dragZone {
    margin: 0.5em;
    padding: 0.5em;
    border: 2px solid blue;
    display: flex;
    flex-direction: column;
  }

  .dragZone.allowed {
    border-color: greenyellow;
  }

  .dragZone.disallowed {
    border-color: red;
  }

  .text {
    font-family: "Courier New", Courier, monospace;
    color: white;
    background-color: black;
    text-align: left;
    white-space: pre;
    margin: 1em 0 0 0;
  }

  .drag-status {
    margin: 1em;
    text-align: center;
  }
</style>
