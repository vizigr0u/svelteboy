export type CheatWatch = {
    name: string;
    address: number;
    size: number; // bytes, 1-4 for raw primitive; computed from schema/fieldType otherwise
    freeze?: boolean;
    freezeValue?: number;
    valueMapName?: string;
    schemaId?: string;
    fieldType?: FieldType; // single-leaf rendering (bcd, ascii, u16be, etc.)
};

export type ValueMap = {
    name: string;
    entries: Record<string, string>; // key = decimal value as string (JSON-safe)
};

export type FieldType =
    | { kind: "u8" }
    | { kind: "u16le" }
    | { kind: "u16be" }
    | { kind: "u32le" }
    | { kind: "ascii"; length: number }
    | { kind: "bcd"; length: number; bigEndian?: boolean }
    | { kind: "enum"; bytes: 1 | 2; mapName: string }
    | { kind: "bitflags"; bytes: 1 | 2; bits: Record<string, string> }
    | { kind: "ref"; schemaId: string }
    | { kind: "array"; count: number; of: FieldType };

export type StructField = {
    name: string;
    offset: number;
    type: FieldType;
};

export type StructSchema = {
    id: string;
    description?: string;
    fields: StructField[];
};

export type CheatCollection = {
    id: string;
    name: string;
    description?: string;
    watches: CheatWatch[];
    schemas: StructSchema[];
    valueMaps: ValueMap[];
};
