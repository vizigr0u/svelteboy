import { MakeIDBStore } from "./idbStore";

export const showRomsWindow     = MakeIDBStore('showRoms', false);
export const showSavesWindow    = MakeIDBStore('showSaves', false);
export const showOptionsWindow  = MakeIDBStore('showOptions', false);
export const showBindingsWindow = MakeIDBStore('showBindings', false);
export const showDebugWindow    = MakeIDBStore('showDebug', false);

export const debugPanels = {
    debugger:  MakeIDBStore('dbg_debugger', true),
    cpu:       MakeIDBStore('dbg_cpu', false),
    logs:      MakeIDBStore('dbg_logs', false),
    hexDump:   MakeIDBStore('dbg_hex', false),
    audio:     MakeIDBStore('dbg_audio', false),
    oam:       MakeIDBStore('dbg_oam', false),
    bgCanvas:  MakeIDBStore('dbg_bg', false),
    benchmark: MakeIDBStore('dbg_bench', false),
};
