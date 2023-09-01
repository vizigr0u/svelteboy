
@final
export class Logger {
    static verbose: u8 = 0;
    static lines: Array<string> = new Array<string>();
    static dumpToConsole: boolean = false;
    static disableBuffer: boolean = false;

    static Init(): void {
        this.lines.splice(0);
    }

    static Log(message: string): void {
        if (Logger.dumpToConsole) {
            console.log(message)
        }

        if (!Logger.disableBuffer && !!message) {
            Logger.lines.push(message);
        }
    }

    static Splice(maxLines: i32): string[] {
        return this.lines.splice(0, maxLines);
    }
}

export function setVerbose(v: u8): void {
    Logger.verbose = v;
}

export function spliceLogs(maxLines: i32): string[] {
    return Logger.Splice(maxLines);
}

export function dumpLogToConsole(enabled: boolean = true, disableBuffer: boolean = true): void {
    Logger.dumpToConsole = enabled;
    Logger.disableBuffer = disableBuffer;
}
