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
}
