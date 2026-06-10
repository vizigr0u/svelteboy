export function shouldAutoResumeOnEnterPlay(args: {
    emulatorInitialized: boolean;
    debuggerAttached: boolean;
}): boolean {
    return args.emulatorInitialized && !args.debuggerAttached;
}
