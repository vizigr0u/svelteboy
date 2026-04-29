<script lang="ts">
  import type { Snippet } from "svelte";
  import { DragState, type LibraryRom } from "../types";
  import { addLibraryRomFromDrop } from "stores/libraryStore";
  import { humanReadableSize } from "../utils";

  let {
    dragState = $bindable(DragState.Idle),
    dragStatus = $bindable(""),
    onRomReceived = (_: LibraryRom) => {},
    validExtensions = ["gb", "gbc"],
    children,
  } = $props<{
    dragState?: DragState;
    dragStatus?: string;
    onRomReceived?: (rom: LibraryRom) => void;
    validExtensions?: string[];
    children: Snippet;
  }>();

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
    const rom = await addLibraryRomFromDrop(file);
    dragState = DragState.Idle;
    dragStatus = "";
    if (rom) onRomReceived(rom);
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
  ondrop={onDrop}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondragenter={onDragEnter}
>
  {@render children()}
</div>
