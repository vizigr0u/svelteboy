<script lang="ts">
  import type { Snippet } from "svelte";
  import { DragState, type LibraryRom } from "../types";
  import { importRomFiles, type ImportReport } from "../romImport";

  let {
    dragState = $bindable(DragState.Idle),
    dragStatus = $bindable(""),
    progress = $bindable<{ done: number; total: number } | undefined>(undefined),
    onRomReceived = (_: LibraryRom) => {},
    onImportComplete = (_: ImportReport) => {},
    children,
  } = $props<{
    dragState?: DragState;
    dragStatus?: string;
    progress?: { done: number; total: number } | undefined;
    onRomReceived?: (rom: LibraryRom) => void;
    onImportComplete?: (report: ImportReport) => void;
    children: Snippet;
  }>();

  const CONFIRM_THRESHOLD = 10;
  let inFlight: Promise<void> = Promise.resolve();

  function getDroppedFiles(e: DragEvent): File[] {
    const dt = e.dataTransfer;
    if (!dt) return [];
    const out: File[] = [];
    for (let i = 0; i < dt.items.length; i++) {
      const it = dt.items[i];
      if (it.kind !== "file") continue;
      const f = it.getAsFile();
      if (f) out.push(f);
    }
    return out;
  }

  function hasAnyFileItem(e: DragEvent): boolean {
    const dt = e.dataTransfer;
    if (!dt) return false;
    for (let i = 0; i < dt.items.length; i++) {
      if (dt.items[i].kind === "file") return true;
    }
    return false;
  }

  async function runImport(files: File[]) {
    if (files.length === 0) {
      dragStatus = "Ignored dropped item(s)";
      return;
    }
    if (files.length > CONFIRM_THRESHOLD) {
      const ok = window.confirm(`Import ${files.length} files?`);
      if (!ok) {
        dragStatus = "Cancelled";
        return;
      }
    }
    progress = { done: 0, total: files.length };
    dragStatus = `Importing ${files.length}...`;
    const report = await importRomFiles(files, (done, total) => {
      progress = { done, total };
    });
    progress = undefined;
    dragState = DragState.Idle;
    dragStatus = "";
    if (report.added.length > 0) onRomReceived(report.added[0]);
    onImportComplete(report);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    const files = getDroppedFiles(e);
    inFlight = inFlight.then(() => runImport(files));
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragState = hasAnyFileItem(e) ? DragState.Accept : DragState.Reject;
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    dragState = hasAnyFileItem(e) ? DragState.Accept : DragState.Reject;
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
