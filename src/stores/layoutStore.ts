import { MakeIDBStore } from "./idbStore";
import type { LayoutId, ControlsPlacement } from "../types";

export const SelectedLayout = MakeIDBStore<LayoutId>('layout', 'console', (v) => (v as string) === 'workbench' ? 'debug' : v);
export const ImmersiveControlsPlacement = MakeIDBStore<ControlsPlacement>('immersiveControls', 'shrink');
