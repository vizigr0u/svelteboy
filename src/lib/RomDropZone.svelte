<script lang="ts">
  import type { Snippet } from "svelte";
  import { DragState, type LibraryRom } from "../types";
  import { addLibraryRomFromDrop } from "stores/libraryStore";
  import { humanReadableSize } from "../utils";
  import { isZipFilename, extractRomFromZip } from "../zipRom";

  let {
    dragState = $bindable(DragState.Idle),
    dragStatus = $bindable(""),
    onRomReceived = (_: LibraryRom) => {},
    validExtensions = ["gb", "gbc", "zip"],
    children,
  } = $props<{
    dragState?: DragState;
    dragStatus?: string;
    onRomReceived?: (rom: LibraryRom) => void;
    validExtensions?: string[];
    children: Snippet;
  }>();

  function getValidDroppedFileItem(e: DragEvent): DataTransferItem | undefined {
    const dt = e.dataTransfer;
    if (!dt || dt.items.length != 1) return undefined;
    if (dt.items[0].kind != "file") return undefined;
    return dt.items[0];
  }

  async function processDroppedFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    dragStatus = `dropped file:
        ${file.name}
      size: ${humanReadableSize(file.size)}`;
    if (!validExtensions.includes(ext)) {
      dragStatus += ": Unknown file type";
      return;
    }

    let target = file;
    if (isZipFilename(file.name)) {
      dragStatus = "Extracting ROM from archive...";
      const buf = await file.arrayBuffer();
      const r = await extractRomFromZip(buf);
      if (!r.ok) {
        dragStatus =
          r.reason === "no-rom"
            ? "No .gb/.gbc found in archive"
            : r.reason === "multi-rom"
              ? "Multiple ROMs in archive — extract manually"
              : "Invalid or corrupt zip file";
        return;
      }
      const innerExt = r.innerName.match(/\.gbc?$/i)![0];
      const stem = file.name.replace(/\.zip$/i, "");
      target = new File([r.bytes], stem + innerExt, {
        type: "application/octet-stream",
      });
    }

    const rom = await addLibraryRomFromDrop(target);
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
