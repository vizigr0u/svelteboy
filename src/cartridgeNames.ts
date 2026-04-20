
let gbNamesPromise: Promise<any> | undefined;
let gbcNamesPromise: Promise<any> | undefined;

export function getGbNames(): Promise<any> {
    if (!gbNamesPromise) {
        gbNamesPromise = fetch("./gbRomNames.json").then((r) => r.json());
    }
    return gbNamesPromise;
}

export function getGbcNames(): Promise<any> {
    if (!gbcNamesPromise) {
        gbcNamesPromise = fetch("./gbcRomNames.json").then((r) => r.json());
    }
    return gbcNamesPromise;
}
