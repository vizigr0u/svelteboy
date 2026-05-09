<script lang="ts">
    import { buildInfo, commitUrl } from "../buildInfo";
</script>

<div class="about">
    <!-- <div class="about-row">
        <span class="about-label">Version:</span>
        <span>{buildInfo.version}</span>
    </div> -->
    <div class="about-row">
        <span class="about-label">Commit:</span>
        <a
            href={commitUrl()}
            target="_blank"
            rel="noopener noreferrer"
            title={buildInfo.sha || "unknown"}
        >
            {buildInfo.shortSha || "unknown"}{buildInfo.dirty ? "-dirty" : ""}
        </a>
    </div>
    {#if buildInfo.branch}
        <div class="about-row">
            <span class="about-label">Branch:</span>
            <span>{buildInfo.branch}</span>
        </div>
    {/if}
    {#if buildInfo.commitDate}
        <div class="about-row">
            <span class="about-label">Committed:</span>
            <span title={buildInfo.commitDate}>
                {new Date(buildInfo.commitDate).toLocaleString()}
            </span>
        </div>
    {/if}
    {#if buildInfo.buildDate}
        <div class="about-row">
            <span class="about-label">Built:</span>
            <span title={buildInfo.buildDate}>
                {new Date(buildInfo.buildDate).toLocaleString()}
            </span>
        </div>
    {/if}
    {#if buildInfo.runId}
        <div class="about-row">
            <span class="about-label">CI run:</span>
            <span>{buildInfo.runId}</span>
        </div>
    {/if}
</div>

<style>
    .about {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        font-size: 0.9em;
        color: #cdd6f4;
    }
    .about-row {
        display: grid;
        grid-template-columns: 7em minmax(0, 1fr);
        align-items: baseline;
    }
    .about-label {
        color: #888;
    }
    .about a {
        color: #89b4fa;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .about a:hover {
        text-decoration: underline;
    }
</style>
