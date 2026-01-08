import { Setting } from "../decorators/settings.js";

export class AppSettings {
    @Setting({
        section: "Appearance",
        label: "Show Tag Count",
        type: "boolean",
        defaultValue: false
    })
    showTagCount = false;

    @Setting({
        section: "Interface",
        label: "Show Diff Section",
        type: "boolean",
        defaultValue: true
    })
    showDiffSection = true;

    @Setting({
        section: "Interface",
        label: "Show Caption Diff List",
        type: "boolean",
        defaultValue: true
    })
    showCaptionDiffList = true;

    @Setting({
        section: "Interface",
        label: "Show Tag Groups",
        type: "boolean",
        defaultValue: true
    })
    showTagGroups = true;

    @Setting({
        section: "Appearance",
        label: "Theme",
        type: "select",
        options: [
            { label: "Dark", value: "dark" },
            { label: "Winter (Light)", value: "winter" }
        ],
        defaultValue: "dark"
    })
    theme = "dark";

    @Setting({
        section: "General",
        label: "Autocomplete",
        type: "boolean",
        defaultValue: true
    })
    autocomplete = true;

    @Setting({
        section: "General",
        label: "Load tags CSV",
        type: "action",
        description: "Import tags from a CSV file into the tags Database.",
        actionId: "loadTagsCsv"
    })
    loadTagsCsvAction = true;

    @Setting({
        section: "Autotagger",
        label: "Ignored tags",
        type: "string[]",
        inputType: "textarea",
        defaultValue: []
    })
    tagsIgnored: string[] = []

    @Setting({
        section: "Autotagger",
        label: "Service port",
        type: "number",
        defaultValue: 3067
    })
    taggerPort = 3067;

    @Setting({
        section: "General",
        label: "Load dataset subdirectories",
        type: "boolean",
        defaultValue: false
    })
    recursiveDatasetLoad = false;

    @Setting({
        section: "General",
        label: "Check for updates automatically",
        type: "boolean",
        defaultValue: true
    })
    autoCheckUpdates = true;

    @Setting({
        section: "General",
        label: "Sort images alphabetically on load",
        type: "boolean",
        defaultValue: false
    })
    sortImagesAlphabetically = false;

    @Setting({
        section: "General",
        label: "Enable hardware acceleration",
        type: "boolean",
        requiresRestart: true,
        defaultValue: true
    })
    enableHardwareAcceleration = true;

    @Setting({
        section: "Shortcuts",
        label: "Load Dataset",
        type: "shortcut",
        defaultValue: "Ctrl+O"
    })
    shortcutLoadDataset = "Ctrl+O";

    @Setting({
        section: "Shortcuts",
        label: "Reload Dataset",
        type: "shortcut",
        defaultValue: "Ctrl+R"
    })
    shortcutReloadDataset = "Ctrl+R";

    @Setting({
        section: "Shortcuts",
        label: "Save",
        type: "shortcut",
        defaultValue: "Ctrl+S"
    })
    shortcutSave = "Ctrl+S";

    @Setting({
        section: "Shortcuts",
        label: "Undo",
        type: "shortcut",
        defaultValue: "Ctrl+Z"
    })
    shortcutUndo = "Ctrl+Z";

    @Setting({
        section: "Shortcuts",
        label: "Redo",
        type: "shortcut",
        defaultValue: "Ctrl+Y"
    })
    shortcutRedo = "Ctrl+Y";

    @Setting({
        section: "Shortcuts",
        label: "Select All Images",
        type: "shortcut",
        defaultValue: "Ctrl+A"
    })
    shortcutSelectAllImages = "Ctrl+A";

    @Setting({
        section: "Shortcuts",
        label: "Navigation Left",
        type: "shortcut",
        defaultValue: "ArrowLeft"
    })
    shortcutNavigationLeft = "ArrowLeft";

    @Setting({
        section: "Shortcuts",
        label: "Navigation Right",
        type: "shortcut",
        defaultValue: "ArrowRight"
    })
    shortcutNavigationRight = "ArrowRight";

    @Setting({
        section: "Shortcuts",
        label: "Navigation Up",
        type: "shortcut",
        defaultValue: "ArrowUp"
    })
    shortcutNavigationUp = "ArrowUp";

    @Setting({
        section: "Shortcuts",
        label: "Navigation Down",
        type: "shortcut",
        defaultValue: "ArrowDown"
    })
    shortcutNavigationDown = "ArrowDown";

    @Setting({
        section: "Shortcuts",
        label: "Toggle Tag Edit Mode",
        type: "shortcut",
        defaultValue: "Ctrl+E"
    })
    shortcutToggleTagEditMode = "Ctrl+E";
}
