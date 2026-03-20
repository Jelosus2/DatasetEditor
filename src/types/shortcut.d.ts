export type ShortcutConfig = {
    combo: string;
    handler: (event: KeyboardEvent) => void | Promise<void>;
    preventDefault?: boolean;
}

export type ShortcutOptions = {
    isEnabled?: () => boolean;
}
