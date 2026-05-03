import { MakeIDBStore as MakeLocalStore } from "../stores/idbStore";
import type { Bindings } from "./types";
import { DEFAULT_BINDINGS } from "./defaults";

export const KeybindingsStore = MakeLocalStore<Bindings>(
    'option-keybindings-v2',
    DEFAULT_BINDINGS,
);
