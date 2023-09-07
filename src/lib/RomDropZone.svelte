<script lang="ts">
  import { cartRomStore } from "../stores/romStores";
  import { type StoredRom } from "../types";
  import { humanReadableSize } from "../utils";
  import { Buffer } from "buffer";

  enum DragState {
    Idle,
    Accept,
    Reject,
  }

  const defaultDragText: string = `drop roms here`;
  const validFileExtensions: string[] = ["gb", "gbc"];

  let dragState: DragState = DragState.Idle;
  let dragZone: HTMLDivElement;
  let dragZoneText: string = defaultDragText;

  function getValidDroppedFileItem(e: DragEvent): DataTransferItem {
    if (e.dataTransfer.items.length != 1) return undefined;
    if (e.dataTransfer.items[0].kind != "file") return undefined;
    return e.dataTransfer.items[0];
  }

  async function processDroppedFile(file: File) {
    const ext = file.name.split(".").pop();
    dragZoneText = `dropped file:
        ${file.name}
      size: ${humanReadableSize(file.size)}`;
    if (!validFileExtensions.includes(ext)) {
      dragZoneText += ": Unknown file type";
      return;
    }
    const buffer = await file.arrayBuffer();
    const sha1Buffer = await crypto.subtle.digest("SHA-1", buffer);
    const hashArray = Array.from(new Uint8Array(sha1Buffer));
    const sha1 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const newRom: StoredRom = {
      name: file.name,
      contentBase64: Buffer.from(buffer).toString("base64"),
      sha1: sha1,
      fileSize: file.size,
    };
    cartRomStore.update((store) => [newRom, ...store]);
    dragState = DragState.Idle;
    dragZoneText = "";
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
    background-color: #1f1f1f;
    border: 2px solid #111;
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
    text-align: left;
    white-space: pre;
    margin: 1em 0 0 0;
  }

  .drag-status {
    margin: 1em;
    text-align: center;
  }
</style>
