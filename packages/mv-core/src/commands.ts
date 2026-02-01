export type CommandContext = {
    // chart coordinate info for right-click, etc.
    time?: number;
    price?: number;
    logicalIndex?: number;
};

export type Command = {
    id: string;
    label: string;
    shortcut?: string;
    icon?: string; // keep as string; UI layer decides how to render
    when?: (ctx: CommandContext) => boolean;
    run: (ctx: CommandContext) => void;
};

export class CommandRegistry {
    private commands = new Map<string, Command>();

    register(cmd: Command) {
        if (this.commands.has(cmd.id)) {
            throw new Error(`Command already registered: ${cmd.id}`);
        }
        this.commands.set(cmd.id, cmd);
        return () => this.commands.delete(cmd.id);
    }

    list(ctx: CommandContext): Command[] {
        return [...this.commands.values()].filter((c) => (c.when ? c.when(ctx) : true));
    }
}
