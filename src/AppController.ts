import type { AppControllerDependencies } from '@/types/controller';
import type { AppCloseAction } from '../shared/app-close';
import type { ActiveTab } from '@/types/app';

export class AppController {
    private deps: AppControllerDependencies;

    constructor(deps: AppControllerDependencies) {
        this.deps = deps;
    }

    async initialize() {
        await Promise.all([
            await this.deps.tagGroupsStore.loadTagGroups(),
            await this.deps.settingsStore.loadSchema()
        ]);

        await this.deps.settingsStore.loadSettings();
        this.deps.settingsStore.loadTheme();
    }

    async loadDataset(reload: boolean = false) {
        return this.deps.datasetStore.loadDataset(reload);
    }

    async reloadDataset() {
        return this.loadDataset(true);
    }

    undoAction() {
        const tab = this.deps.getActiveTab();
        const action = this.undoByTab[tab];
        action?.();
    }

    redoAction() {
        const tab = this.deps.getActiveTab();
        const action = this.redoByTab[tab];
        action?.();
    }

    async saveChanges() {
        const tab = this.deps.getActiveTab();
        const action = this.saveByTab[tab];
        await action?.();
    }

    async saveAllChanges() {
        const [datasetSaved, tagGroupsSaved, settingsSaved] = await Promise.all([
            this.deps.datasetStore.isDatasetSaved(),
            this.deps.tagGroupsStore.areTagGroupsSaved(),
            this.deps.settingsStore.areSettingsSaved()
        ]);

        const tasks: Promise<void>[] = [];

        if (!datasetSaved)
            tasks.push(this.deps.datasetStore.saveDataset());
        if (!tagGroupsSaved)
            tasks.push(this.deps.tagGroupsStore.saveTagGroups());
        if (!settingsSaved)
            tasks.push(this.saveSettingsWithGuards(/* showWarnings = */ false));

        await Promise.all(tasks);
    }

    async areAllChangesSaved() {
        const [datasetSaved, tagGroupsSaved, settingsSaved] = await Promise.all([
            this.deps.datasetStore.isDatasetSaved(),
            this.deps.tagGroupsStore.areTagGroupsSaved(),
            this.deps.settingsStore.areSettingsSaved()
        ]);

        return datasetSaved && tagGroupsSaved && settingsSaved;
    }

    async handleCloseRequest(action: AppCloseAction) {
        if (action === "save")
            await this.saveAllChanges();

        return this.areAllChangesSaved();
    }

    private async saveSettingsWithGuards(showWarnings: boolean = true) {
        if (!this.deps.settingsStore.hasChanges) {
            if (showWarnings)
                this.deps.showAlert("warning", "There's no changes in settings to save");
            return;
        }

        if (this.deps.settingsStore.shortcutConflicts.size > 0) {
            this.deps.showAlert("error", "Resolve the shortcut conflicts");
            return;
        }

        if (this.deps.settingsStore.directoryErrorsCount > 0) {
            this.deps.showAlert("error", "Set valid directory paths");
            return;
        }

        await this.deps.settingsStore.saveSettings();
    }

    private undoByTab: Partial<Record<ActiveTab, () => void>> = {
        "dataset": () => this.deps.datasetStore.undoDatasetAction(),
        "tag-groups": () => this.deps.tagGroupsStore.undoTagGroupsAction(),
        "settings": () => this.deps.settingsStore.undoSettingsAction()
    };

    private redoByTab: Partial<Record<ActiveTab, () => void>> = {
        "dataset": () => this.deps.datasetStore.redoDatasetAction(),
        "tag-groups": () => this.deps.tagGroupsStore.redoTagGroupsAction(),
        "settings": () => this.deps.settingsStore.redoSettingsAction()
    };

    private saveByTab: Partial<Record<ActiveTab, () => Promise<void>>> = {
        "dataset": async () => {
            await this.deps.datasetStore.saveDataset();
        },
        "tag-groups": async () => {
            await this.deps.tagGroupsStore.saveTagGroups();
        },
        "settings": async () => {
            await this.saveSettingsWithGuards();
        }
    };
}
