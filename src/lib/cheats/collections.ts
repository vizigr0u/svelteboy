import type {
    CheatCollection,
    CheatWatch,
    FieldType,
    StructSchema,
    ValueMap,
} from "./types";
import { MAX_SCHEMA_DEPTH, type SchemaMap } from "./schema";

export function mergeSchemas(collections: CheatCollection[]): SchemaMap {
    const m = new Map<string, StructSchema>();
    for (const c of collections) {
        for (const s of c.schemas) {
            if (m.has(s.id)) {
                console.warn(
                    `[CheatCollections] schema id collision "${s.id}" — using "${c.name}" version`,
                );
            }
            m.set(s.id, s);
        }
    }
    return m;
}

export function mergeValueMaps(collections: CheatCollection[]): Map<string, ValueMap> {
    const m = new Map<string, ValueMap>();
    for (const c of collections) {
        for (const v of c.valueMaps) {
            if (m.has(v.name)) {
                console.warn(
                    `[CheatCollections] value-map name collision "${v.name}" — using "${c.name}" version`,
                );
            }
            m.set(v.name, v);
        }
    }
    return m;
}

function collectMapNamesFromType(
    t: FieldType,
    out: Set<string>,
    depth = 0,
): void {
    if (depth > MAX_SCHEMA_DEPTH) return;
    if (t.kind === "enum") out.add(t.mapName);
    if (t.kind === "array") collectMapNamesFromType(t.of, out, depth + 1);
}

function collectSchemaIdsFromType(
    t: FieldType,
    schemaMap: SchemaMap,
    out: Set<string>,
    depth = 0,
): void {
    if (depth > MAX_SCHEMA_DEPTH) return;
    if (t.kind === "ref") {
        if (out.has(t.schemaId)) return;
        out.add(t.schemaId);
        const s = schemaMap.get(t.schemaId);
        if (s) {
            for (const f of s.fields) {
                collectSchemaIdsFromType(f.type, schemaMap, out, depth + 1);
            }
        }
    }
    if (t.kind === "array") {
        collectSchemaIdsFromType(t.of, schemaMap, out, depth + 1);
    }
}

export function transitiveSchemaIds(
    rootIds: string[],
    schemaMap: SchemaMap,
): Set<string> {
    const out = new Set<string>();
    for (const id of rootIds) {
        if (out.has(id)) continue;
        out.add(id);
        const s = schemaMap.get(id);
        if (!s) continue;
        for (const f of s.fields) {
            collectSchemaIdsFromType(f.type, schemaMap, out, 0);
        }
    }
    return out;
}

export function bundleFromWatches(
    watches: CheatWatch[],
    schemaMap: SchemaMap,
    valueMapMap: Map<string, ValueMap>,
    meta: { id: string; name: string; description?: string },
): CheatCollection {
    const rootSchemaIds: string[] = [];
    for (const w of watches) {
        if (w.schemaId) rootSchemaIds.push(w.schemaId);
    }
    const ids = transitiveSchemaIds(rootSchemaIds, schemaMap);
    const schemas: StructSchema[] = [];
    for (const id of ids) {
        const s = schemaMap.get(id);
        if (s) schemas.push(s);
    }

    const mapNames = new Set<string>();
    for (const w of watches) {
        if (w.valueMapName) mapNames.add(w.valueMapName);
    }
    for (const s of schemas) {
        for (const f of s.fields) {
            collectMapNamesFromType(f.type, mapNames);
        }
    }
    const valueMaps: ValueMap[] = [];
    for (const name of mapNames) {
        const m = valueMapMap.get(name);
        if (m) valueMaps.push(m);
    }

    return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        watches: watches.map((w) => ({ ...w })),
        schemas: schemas.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) })),
        valueMaps: valueMaps.map((v) => ({ name: v.name, entries: { ...v.entries } })),
    };
}

export function isCheatWatch(x: unknown): x is CheatWatch {
    if (!x || typeof x !== "object") return false;
    const w = x as Record<string, unknown>;
    return (
        typeof w.name === "string" &&
        typeof w.address === "number" &&
        typeof w.size === "number"
    );
}

export function isValueMap(x: unknown): x is ValueMap {
    if (!x || typeof x !== "object") return false;
    const m = x as Record<string, unknown>;
    return (
        typeof m.name === "string" &&
        !!m.entries &&
        typeof m.entries === "object"
    );
}

export function isStructSchema(x: unknown): x is StructSchema {
    if (!x || typeof x !== "object") return false;
    const s = x as Record<string, unknown>;
    return typeof s.id === "string" && Array.isArray(s.fields);
}

export function isCheatCollection(x: unknown): x is CheatCollection {
    if (!x || typeof x !== "object") return false;
    const c = x as Record<string, unknown>;
    return (
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        Array.isArray(c.watches) &&
        c.watches.every(isCheatWatch) &&
        Array.isArray(c.schemas) &&
        c.schemas.every(isStructSchema) &&
        Array.isArray(c.valueMaps) &&
        c.valueMaps.every(isValueMap)
    );
}

export function cloneCollection(c: CheatCollection): CheatCollection {
    return {
        id: c.id,
        name: c.name,
        description: c.description,
        watches: c.watches.map((w) => ({ ...w })),
        schemas: c.schemas.map((s) => ({
            ...s,
            fields: s.fields.map((f) => ({ ...f })),
        })),
        valueMaps: c.valueMaps.map((v) => ({ name: v.name, entries: { ...v.entries } })),
    };
}
