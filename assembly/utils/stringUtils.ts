export function uToHex<T>(v: T): string {
    let s: string;
    switch (sizeof<T>()) {
        case 1:
            s = (<u8>v).toString(16);
            break;
        case 2:
            s = (<u16>v).toString(16);
            break;
        default:
            s = (<u32>v).toString(16);
            break;
    }
    return '0x' + s.padStart(sizeof<T>() * 2, '0');
}