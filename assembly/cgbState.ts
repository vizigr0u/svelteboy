let _isCGB: boolean = false;

export function setIsCGB(value: boolean): void {
    _isCGB = value;
}

@inline
export function isCgbMode(): boolean {
    return _isCGB;
}
