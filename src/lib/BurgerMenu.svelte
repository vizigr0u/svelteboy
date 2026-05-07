<script lang="ts">
    interface MenuItem {
        label: string;
        active: boolean;
        toggle: () => void;
        disabled?: boolean;
        header?: string;
    }

    interface Props {
        items: MenuItem[];
        direction?: 'up' | 'down';
    }

    let { items, direction = 'up' }: Props = $props();
</script>

<div class="burger-menu" class:down={direction === 'down'}>
    {#each items as item}
        {#if item.header}
            <div class="menu-header">{item.header}</div>
        {/if}
        <button
            class="menu-item"
            class:active={item.active}
            onclick={item.toggle}
            disabled={item.disabled}
        >
            {item.label}
        </button>
    {/each}
</div>

<style>
    .burger-menu {
        position: absolute;
        z-index: 200;
        bottom: 0;
        right: calc(100% + 0.3em);
        background: #1e1e2e;
        border: 1px solid #45475a;
        border-radius: 0.4em;
        display: flex;
        flex-direction: column;
        min-width: 140px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        overflow: hidden;
    }

    .burger-menu.down {
        bottom: auto;
        right: 0;
        top: calc(100% + 0.3em);
    }

    .menu-header {
        padding: 0.45em 1em 0.2em;
        font-size: 0.7em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #7f849c;
        border-top: 1px solid #313244;
    }

    .menu-header:first-child {
        border-top: none;
    }

    .menu-item {
        background: none;
        border: none;
        color: #cdd6f4;
        padding: 0.6em 1em;
        text-align: left;
        cursor: pointer;
        font-size: 0.9em;
    }

    .menu-item:hover {
        background: #313244;
    }

    .menu-item.active {
        color: #a6e3a1;
    }

    .menu-item.active::before {
        content: "✓ ";
    }

    .menu-item:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .menu-item:disabled:hover {
        background: none;
    }
</style>
