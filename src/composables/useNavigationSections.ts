import type { MenuSection, NavigationEmit } from "@/types/navigation-bar";
import type { Ref } from "vue";

import { useSettingsStore } from "@/stores/settingsStore";

export function useNavigationSections(emit: NavigationEmit, arePreviewsEnabled: Ref<boolean>): MenuSection[] {
    const settingsStore = useSettingsStore();

    const shortcutParts = (value: string) => value ? value.split("+") : undefined;

    return [
        {
            id: "file",
            label: "File",
            menuWidthClass: "min-w-56 w-max max-w-md",
            items: [
                { kind: "action", label: "Load Dataset", shortcut: shortcutParts(settingsStore.getSetting("shortcutLoadDataset")), action: () => emit("load_dataset") },
                { kind: "action", label: "Reload Dataset", shortcut: shortcutParts(settingsStore.getSetting("shortcutReloadDataset")), action: () => emit("reload_dataset") },
                { kind: "action", label: "Save", shortcut: shortcutParts(settingsStore.getSetting("shortcutSave")), action: () => emit("save") }
            ]
        },
        {
            id: "edit",
            label: "Edit",
            menuWidthClass: "min-w-45 w-max max-w-md",
            items: [
                { kind: "action", label: "Undo", shortcut: shortcutParts(settingsStore.getSetting("shortcutUndo")), action: () => emit("undo") },
                { kind: "action", label: "Redo", shortcut: shortcutParts(settingsStore.getSetting("shortcutRedo")), action: () => emit("redo") }
            ]
        },
        {
            id: "view",
            label: "View",
            menuWidthClass: "min-w-52 w-max max-w-md",
            items: [
                { kind: "toggle", label: "Image Previews", model: arePreviewsEnabled }
            ]
        },
        {
            id: "tools",
            label: "Tools",
            menuWidthClass: "min-w-55 w-max max-w-lg",
            items: [
                { kind: "modal", label: "Set image background color", targetId: "background_color_modal" },
                { kind: "modal", label: "Search Danbooru Wiki", targetId: "danbooru_wiki_modal" },
                { kind: "modal", label: "Crop image", targetId: "crop_image_modal" },
                { kind: "modal", label: "Find duplicate images", targetId: "duplicate_finder_modal" },
                { kind: "modal", label: "Rename files", targetId: "rename_files_modal" }
            ]
        }
    ];
}
