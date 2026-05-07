import { MakeIDBStore as MakeLocalStore } from "stores/idbStore";
import type { CheatCollection, CheatWatch } from "./types";

export const Cheats = MakeLocalStore<CheatWatch[]>("DebugCheats", []);
export const CheatCollections = MakeLocalStore<CheatCollection[]>("DebugCheatCollections", []);
