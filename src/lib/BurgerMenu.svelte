<script lang="ts">
    interface MenuItem {
        label: string;
        active: boolean;
        toggle: () => void;
        disabled?: boolean;
    }

    interface Props {
        items: MenuItem[];
    }

    let { items }: Props = $props();
</script>

<div class="burger-menu">
    {#each items as item}
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
        top: 2.5em;
        right: 0.5em;
        background: #1e1e2e;
        border: 1px solid #45475a;
        border-radius: 0.4em;
        display: flex;
        flex-direction: column;
        min-width: 140px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        overflow: hidden;
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
