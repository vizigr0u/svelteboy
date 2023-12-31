export function humanReadableNumber(size: number): string {
    const bytePrefix = ["", "K", "M", "B"];
    let prefixIndex = 0;
    while (size > 1000 && prefixIndex < bytePrefix.length - 1) {
        prefixIndex++;
        size /= 1000;
    }
    return size.toFixed(0) + ' ' + bytePrefix[prefixIndex];
}


export function humanReadableSize(size: number): string {
    const bytePrefix = ["", "K", "M", " G"];
    let prefixIndex = 0;
    while (size > 1024 && prefixIndex < bytePrefix.length - 1) {
        prefixIndex++;
        size /= 1024;
    }
    return `${size.toFixed(0)} ${bytePrefix[prefixIndex]}B`;
}

export function uToHex(n: number): string {
    return '0x' + n.toString(16).padStart(2, '0');
}

export function uToHex16(n: number): string {
    return '0x' + n.toString(16).padStart(4, '0');
}