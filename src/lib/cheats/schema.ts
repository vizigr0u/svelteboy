import type { FieldType, StructSchema } from "./types";

export const MAX_SCHEMA_DEPTH = 8;

export type SchemaMap = Map<string, StructSchema>;

export function buildSchemaMap(schemas: StructSchema[]): SchemaMap {
    const m = new Map<string, StructSchema>();
    for (const s of schemas) m.set(s.id, s);
    return m;
}

export function fieldTypeSize(
    t: FieldType,
    schemas: SchemaMap,
    depth = 0,
): number {
    if (depth > MAX_SCHEMA_DEPTH) return 0;
    switch (t.kind) {
        case "u8":
            return 1;
        case "u16le":
        case "u16be":
            return 2;
        case "u32le":
            return 4;
        case "ascii":
        case "bcd":
            return Math.max(0, t.length | 0);
        case "enum":
            return t.bytes;
        case "bitflags":
            return t.bytes;
        case "array":
            return Math.max(0, t.count | 0) * fieldTypeSize(t.of, schemas, depth + 1);
        case "ref": {
            const s = schemas.get(t.schemaId);
            if (!s) return 0;
            return schemaSize(s, schemas, depth + 1);
        }
    }
}

export function schemaSize(
    s: StructSchema,
    schemas: SchemaMap,
    depth = 0,
): number {
    if (depth > MAX_SCHEMA_DEPTH) return 0;
    let max = 0;
    for (const f of s.fields) {
        const end = f.offset + fieldTypeSize(f.type, schemas, depth + 1);
        if (end > max) max = end;
    }
    return max;
}

export type SchemaValidationResult = {
    valid: boolean;
    errors: string[];
};

export function validateSchemas(schemas: StructSchema[]): SchemaValidationResult {
    const errors: string[] = [];
    const map = buildSchemaMap(schemas);

    if (map.size !== schemas.length) {
        errors.push("Duplicate schema id");
    }

    for (const s of schemas) {
        if (!s.id || typeof s.id !== "string") {
            errors.push("Schema missing id");
            continue;
        }
        if (!Array.isArray(s.fields)) {
            errors.push(`Schema ${s.id}: fields must be array`);
            continue;
        }
        for (const f of s.fields) {
            if (typeof f.name !== "string" || typeof f.offset !== "number") {
                errors.push(`Schema ${s.id}: invalid field`);
                continue;
            }
            const refErr = checkRefs(f.type, map, 0, s.id);
            if (refErr) errors.push(`Schema ${s.id}.${f.name}: ${refErr}`);
        }
    }

    for (const s of schemas) {
        if (hasCycle(s, map)) errors.push(`Schema ${s.id}: cyclic reference`);
    }

    return { valid: errors.length === 0, errors };
}

function checkRefs(
    t: FieldType,
    map: SchemaMap,
    depth: number,
    fromId: string,
): string | null {
    if (depth > MAX_SCHEMA_DEPTH) return "depth exceeded";
    if (t.kind === "ref") {
        if (!map.has(t.schemaId)) return `unknown schema "${t.schemaId}"`;
    }
    if (t.kind === "array") return checkRefs(t.of, map, depth + 1, fromId);
    return null;
}

function hasCycle(start: StructSchema, map: SchemaMap): boolean {
    const stack = new Set<string>();
    function visit(s: StructSchema): boolean {
        if (stack.has(s.id)) return true;
        stack.add(s.id);
        for (const f of s.fields) {
            if (visitType(f.type)) return true;
        }
        stack.delete(s.id);
        return false;
    }
    function visitType(t: FieldType): boolean {
        if (t.kind === "ref") {
            const next = map.get(t.schemaId);
            if (next && visit(next)) return true;
        }
        if (t.kind === "array") return visitType(t.of);
        return false;
    }
    return visit(start);
}

export function readU(bytes: Uint8Array, offset: number, size: number, littleEndian: boolean): number {
    let v = 0;
    if (littleEndian) {
        for (let i = size - 1; i >= 0; i--) v = v * 256 + (bytes[offset + i] ?? 0);
    } else {
        for (let i = 0; i < size; i++) v = v * 256 + (bytes[offset + i] ?? 0);
    }
    return v;
}

export function readBcd(bytes: Uint8Array, offset: number, length: number, bigEndian: boolean): number {
    let v = 0;
    const start = bigEndian ? 0 : length - 1;
    const step = bigEndian ? 1 : -1;
    for (let i = 0; i < length; i++) {
        const b = bytes[offset + start + i * step] ?? 0;
        v = v * 100 + ((b >> 4) & 0xf) * 10 + (b & 0xf);
    }
    return v;
}

export function readAscii(bytes: Uint8Array, offset: number, length: number): string {
    let s = "";
    for (let i = 0; i < length; i++) {
        const b = bytes[offset + i];
        if (b === undefined || b === 0) break;
        s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
    }
    return s;
}

export function leToBytes(value: number, size: number): number[] {
    const out: number[] = new Array(size);
    let v = Math.max(0, Math.floor(value));
    for (let i = 0; i < size; i++) {
        out[i] = v & 0xff;
        v = Math.floor(v / 256);
    }
    return out;
}

export function beToBytes(value: number, size: number): number[] {
    return leToBytes(value, size).reverse();
}

export function bcdToBytes(value: number, length: number, bigEndian: boolean): number[] {
    let v = Math.max(0, Math.floor(value));
    const out: number[] = new Array(length).fill(0);
    for (let i = length - 1; i >= 0; i--) {
        const lo = v % 10;
        v = Math.floor(v / 10);
        const hi = v % 10;
        v = Math.floor(v / 10);
        out[i] = ((hi & 0xf) << 4) | (lo & 0xf);
    }
    return bigEndian ? out : out.reverse();
}
