import type { Ref } from "vue";

export type NavigationEventMap = {
    load_dataset: [];
    reload_dataset: [];
    save: [];
    undo: [];
    redo: [];
};

export type NavigationEmit = <K extends keyof NavigationEventMap>(
    event: K,
    ...args: NavigationEventMap[K]
) => void;

export type ActionItem = { kind: "action"; label: string; shortcut?: string[]; action: () => void; }
export type ToggleItem = { kind: "toggle"; label: string; model: Ref<boolean>; }
export type ModalItem = { kind: "modal"; label: string; targetId: string; }

export type MenuItem = ActionItem | ToggleItem | ModalItem;

export type MenuSection = {
    id: string;
    label: string;
    menuWidthClass: string;
    items: MenuItem[];
}

export type UpdateState = "check" | "download" | "restart";
