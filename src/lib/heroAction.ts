export type HeroAction = 'resume' | 'play';

type ResolveArgs = {
    heroSha1: string;
    loadedSha1: string | undefined;
    emulatorInitialized: boolean;
};

type PillArgs = {
    heroSha1: string | undefined;
    loadedSha1: string | undefined;
};

interface ResolveHeroActionFn {
    (args: ResolveArgs): HeroAction;
    pillRedundantWhenHeroVisible(args: PillArgs): boolean;
}

const fn = ((args: ResolveArgs): HeroAction => {
    if (args.loadedSha1 && args.heroSha1 === args.loadedSha1 && args.emulatorInitialized)
        return 'resume';
    return 'play';
}) as ResolveHeroActionFn;

fn.pillRedundantWhenHeroVisible = ({ heroSha1, loadedSha1 }: PillArgs): boolean =>
    !!heroSha1 && !!loadedSha1 && heroSha1 === loadedSha1;

export const resolveHeroAction: ResolveHeroActionFn = fn;
