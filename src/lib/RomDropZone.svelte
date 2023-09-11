<script lang="ts">
  import { cartRomStore } from "stores/romStores";
  import { DragState, type LocalRom, type StoredRom } from "../types";
  import { humanReadableSize } from "../utils";
  import { Buffer } from "buffer";

  export let dragState: DragState = DragState.Idle;
  export let dragStatus: string = "";
  export let onRomReceived: (rom: LocalRom) => void = (_) => {};
  export let saveRom: boolean = true;

  export let validExtensions: string[] = ["gb"];

  function getValidDroppedFileItem(e: DragEvent): DataTransferItem {
    if (e.dataTransfer.items.length != 1) return undefined;
    if (e.dataTransfer.items[0].kind != "file") return undefined;
    return e.dataTransfer.items[0];
  }

  async function processDroppedFile(file: File) {
    const ext = file.name.split(".").pop();
    dragStatus = `dropped file:
        ${file.name}
      size: ${humanReadableSize(file.size)}`;
    if (!validExtensions.includes(ext)) {
      dragStatus += ": Unknown file type";
      return;
    }
    const buffer = await file.arrayBuffer();
    const sha1Buffer = await crypto.subtle.digest("SHA-1", buffer);
    const hashArray = Array.from(new Uint8Array(sha1Buffer));
    const sha1 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    const newRom: LocalRom = {
      name: file.name,
      buffer,
      sha1: sha1,
    };
    if (saveRom && !$cartRomStore.find((r) => r.sha1 == newRom.sha1)) {
      const newStoredRom: StoredRom = {
        name: newRom.name,
        sha1: newRom.sha1,
        contentBase64: Buffer.from(buffer).toString("base64"),
        fileSize: file.size,
      };
      cartRomStore.update((store) => [newStoredRom, ...store]);
    }
    dragState = DragState.Idle;
    dragStatus = "";
    onRomReceived(newRom);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    let file = getValidDroppedFileItem(e)?.getAsFile();
    if (file != undefined) {
      processDroppedFile(file);
    } else {
      dragStatus = "Ignored dropped item(s)";
    }
  }
  function onDragOver(e: DragEvent) {
    dragState = getValidDroppedFileItem(e)
      ? DragState.Accept
      : DragState.Reject;
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
  role="none"
  class="dragZone text"
  on:drop={onDrop}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:dragenter={onDragEnter}
>
  <slot />
</div>
