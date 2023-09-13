
let fetching = false;
let gbNames = undefined;
let gbcNames = undefined;

export async function getGbNames(): Promise<any> {
    if (!fetching && gbNames == undefined) {
        fetching = true;
        const res = await fetch("./gbRomNames.json");
        gbNames = await res.json();
        fetching = false;
    }
    return gbNames;
}

export async function getGbcNames(): Promise<any> {
    if (!fetching && gbcNames == undefined) {
        fetching = true;
        const res = await fetch("./gbcRomNames.json");
        gbcNames = await res.json();
        fetching = false;
    }
    return gbcNames;
}
