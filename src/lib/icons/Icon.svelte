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
        | "xmark";

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
    @keyframes icon-spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
