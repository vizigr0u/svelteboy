declare const __BUILD_INFO__: {
    version: string;
    sha: string;
    shortSha: string;
    branch: string;
    dirty: boolean;
    commitDate: string;
    buildDate: string;
    runId: string;
};

export type BuildInfo = typeof __BUILD_INFO__;

export const buildInfo: BuildInfo = __BUILD_INFO__;

const REPO_URL = "https://github.com/vizigr0u/svelteboy";

export function commitUrl(sha: string = buildInfo.sha): string {
    return `${REPO_URL}/commit/${sha}`;
}
