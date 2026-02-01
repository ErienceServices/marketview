import type { CommandContext, CommandRegistry } from "./commands";

export type ContextMenuItem = {
    id: string;
    label: string;
    shortcut?: string;
    disabled?: boolean;
    onClick: () => void;
};

export type ContextMenuModel = {
    x: number;
    y: number;
    items: ContextMenuItem[];
};

export function buildContextMenuModel(
    registry: CommandRegistry,
    ctx: CommandContext,
    x: number,
    y: number
): ContextMenuModel {
    const cmds = registry.list(ctx);
    return {
        x,
        y,
        items: cmds.map((c) => ({
            id: c.id,
            label: c.label,
            shortcut: c.shortcut,
            disabled: c.when ? !c.when(ctx) : false,
            onClick: () => c.run(ctx)
        }))
    };
}
