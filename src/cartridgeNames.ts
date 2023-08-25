
let gbNames = undefined;
let gbcNames = undefined;

export async function getGbNames(): Promise<any> {
    if (gbNames == undefined) {
        console.log('Fetching /gbRomNames.json...');
        const res = await fetch("./gbRomNames.json");
        gbNames = await res.json();
        console.log('done');
    }
    return gbNames;
}

export async function getGbcNames(): Promise<any> {
    if (gbcNames == undefined) {
        console.log('Fetching /gbcRomNames.json...');
        const res = await fetch("./gbcRomNames.json");
        gbcNames = await res.json();
        console.log('done');
    }
    return gbcNames;
}
