<script lang="ts">
    export type IconName =
        | "hard-drive"
        | "cloud"
        | "question"
        | "spinner"
        | "circle-play"
        | "cloud-arrow-down"
        | "cloud-arrow-up"
        | "magnifying-glass"
        | "filter"
        | "trash"
        | "rotate"
        | "triangle-exclamation"
        | "xmark"
        | "clock"
        | "battery"
        | "bookmark"
        | "pause"
        | "play"
        | "gear"
        | "chevron-down"
        | "library";

    let { name, spin = false } = $props<{
        name: IconName;
        spin?: boolean;
    }>();
</script>

<i class="icon" class:spin={spin || name === "spinner"} aria-hidden="true">
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        {#if name === "hard-drive"}
            <line x1="22" y1="12" x2="2" y2="12" />
            <path
                d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
            />
            <line x1="6" y1="16" x2="6.01" y2="16" />
            <line x1="10" y1="16" x2="10.01" y2="16" />
        {:else if name === "cloud"}
            <path
                d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"
            />
        {:else if name === "question"}
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        {:else if name === "spinner"}
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        {:else if name === "circle-play"}
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
        {:else if name === "cloud-arrow-down"}
            <path
                d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
            />
            <path d="M12 13v8" />
            <path d="m8 17 4 4 4-4" />
        {:else if name === "cloud-arrow-up"}
            <path
                d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"
            />
            <path d="M12 21V13" />
            <path d="m16 17-4-4-4 4" />
        {:else if name === "magnifying-glass"}
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        {:else if name === "filter"}
            <polygon
                points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
            />
        {:else if name === "trash"}
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" x2="10" y1="11" y2="17" />
            <line x1="14" x2="14" y1="11" y2="17" />
        {:else if name === "rotate"}
            <path
                d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
            />
            <path d="M21 3v5h-5" />
        {:else if name === "triangle-exclamation"}
            <path
                d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"
            />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        {:else if name === "xmark"}
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        {:else if name === "clock"}
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        {:else if name === "battery"}
            <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
            <line x1="23" y1="13" x2="23" y2="11" />
            <line x1="6" y1="10" x2="6" y2="14" />
            <line x1="10" y1="10" x2="10" y2="14" />
        {:else if name === "bookmark"}
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        {:else if name === "pause"}
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
        {:else if name === "play"}
            <polygon points="6 4 20 12 6 20 6 4" />
        {:else if name === "gear"}
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        {:else if name === "chevron-down"}
            <polyline points="6 9 12 15 18 9" />
        {:else if name === "library"}
            <g transform="scale(0.75)" fill="currentColor" stroke="none">
                <path
                    d="M11.3467 2.66676H20.6535C20.9635 2.66668 21.2011 2.66662 21.4089 2.68694C22.8859 2.83144 24.095 3.71952 24.6077 4.91578H7.39258C7.90526 3.71952 9.11427 2.83144 10.5914 2.68694C10.7991 2.66662 11.0368 2.66668 11.3467 2.66676Z"
                />
                <path
                    d="M8.41426 6.29761C6.56009 6.29761 5.03974 7.41727 4.53237 8.90266C4.52179 8.93362 4.51165 8.96475 4.50195 8.99602C5.03282 8.83526 5.58531 8.73023 6.14459 8.65854C7.5851 8.47386 9.40555 8.47395 11.5203 8.47407H11.6782H20.7097C22.8244 8.47395 24.6449 8.47386 26.0854 8.65854C26.6446 8.73023 27.1972 8.83526 27.728 8.99602C27.7184 8.96475 27.7082 8.93362 27.6976 8.90266C27.1902 7.41727 25.6698 6.29761 23.8157 6.29761H8.41426Z"
                />
                <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M11.563 10.0562H20.4366C24.9364 10.0562 27.1862 10.0562 28.4501 11.3719C29.7138 12.6877 29.4165 14.7205 28.8218 18.7862L28.2578 22.6416C27.7914 25.83 27.5584 27.4241 26.3621 28.3788C25.1658 29.3334 23.4014 29.3334 19.8726 29.3334H12.127C8.59825 29.3334 6.83388 29.3334 5.63762 28.3788C4.44137 27.4241 4.20818 25.83 3.74181 22.6416L3.17785 18.7862C2.58314 14.7205 2.2858 12.6877 3.5496 11.3719C4.8134 10.0562 7.06328 10.0562 11.563 10.0562ZM10.6665 24.0002C10.6665 23.448 11.164 23.0002 11.7776 23.0002H20.2221C20.8357 23.0002 21.3332 23.448 21.3332 24.0002C21.3332 24.5526 20.8357 25.0004 20.2221 25.0004H11.7776C11.164 25.0004 10.6665 24.5526 10.6665 24.0002Z"
                />
            </g>
        {/if}
    </svg>
</i>

<style>
    .icon {
        display: inline-block;
        line-height: 0;
        font-style: normal;
    }
    .icon svg {
        width: 1em;
        height: 1em;
        vertical-align: -0.125em;
    }
    .spin {
        animation: icon-spin 1s linear infinite;
    }
</style>
