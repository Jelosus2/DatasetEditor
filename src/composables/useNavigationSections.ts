import type { MenuSection, NavigationEmit } from "@/types/navigation-bar";
import type { Ref } from "vue";

export function useNavigationSections(emit: NavigationEmit, arePreviewsEnabled: Ref<boolean>): MenuSection[] {
    return [
        {
            id: "file",
            label: "File",
            menuWidthClass: "w-56",
            items: [
                { kind: "action", label: "Load Dataset", shortcut: ["Ctrl", "O"], action: () => emit("load_dataset") },
                { kind: "action", label: "Reload Dataset", shortcut: ["Ctrl", "R"], action: () => emit("reload_dataset") },
                { kind: "action", label: "Save", shortcut: ["Ctrl", "S"], action: () => emit("save") }
            ]
        },
        {
            id: "edit",
            label: "Edit",
            menuWidthClass: "w-52",
            items: [
                { kind: "action", label: "Undo", shortcut: ["Ctrl", "Z"], action: () => emit("undo") },
                { kind: "action", label: "Redo", shortcut: ["Ctrl", "Y"], action: () => emit("redo") }
            ]
        },
        {
            id: "view",
            label: "View",
            menuWidthClass: "w-52",
            items: [
                { kind: "toggle", label: "Image Previews", model: arePreviewsEnabled }
            ]
        },
        {
            id: "tools",
            label: "Tools",
            menuWidthClass: "w-75",
            items: [
                { kind: "modal", label: "Autotag Images", targetId: "autotagger_modal" },
                { kind: "modal", label: "Add background color to selected images", targetId: "background_color_modal" },
                { kind: "modal", label: "Search Danbooru Wiki", targetId: "danbooru_wiki_modal" },
                { kind: "modal", label: "Crop image", targetId: "crop_image_modal" },
                { kind: "modal", label: "Find duplicate images", targetId: "duplicate_finder_modal" },
                { kind: "modal", label: "Rename files", targetId: "rename_files_modal" }
            ]
        }
    ];
}
