import type { AlertType } from '@/types/alert';
import type { useDatasetStore } from '@/stores/datasetStore';
import type { useTagGroupsStore } from '@/stores/tagGroupsStore';
import type { useSettingsStore } from '@/stores/settingsStore';
import { useLogStore } from '@/stores/logStore';

export interface AppControllerDependencies {
  datasetStore: ReturnType<typeof useDatasetStore>;
  tagGroupsStore: ReturnType<typeof useTagGroupsStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  showAlert: (type: AlertType, message: string) => void;
}

export class AppController {
  private logStore = useLogStore();

  constructor(private deps: AppControllerDependencies) {}

  async initialize() {
    await this.deps.tagGroupsStore.loadTagGroups();
    await this.deps.settingsStore.loadSchema();
    await this.deps.settingsStore.loadSettings();
    this.deps.settingsStore.loadTheme();
  }

  async loadDataset(reload = false) {
    try {
      await this.deps.datasetStore.loadDataset(reload);
    } catch (error) {
      this.deps.showAlert('error', 'Failed to load dataset');
      this.logStore.addLog('error', `Error loading dataset: ${(error as Error).message}`);
    }
  }

  async reloadDataset() {
    await this.loadDataset(true);
  }

  undoAction() {
    const activeTab = this.getActiveTab();

    if (activeTab === 'Dataset') {
      this.deps.datasetStore.undoDatasetAction();
    } else if (activeTab === 'Tag Groups') {
      this.deps.tagGroupsStore.undoTagGroupsAction();
    } else if (activeTab === 'Settings') {
      this.deps.settingsStore.undoSettingsAction();
    }
  }

  redoAction() {
    const activeTab = this.getActiveTab();

    if (activeTab === 'Dataset') {
      this.deps.datasetStore.redoDatasetAction();
    } else if (activeTab === 'Tag Groups') {
      this.deps.tagGroupsStore.redoTagGroupsAction();
    } else if (activeTab === 'Settings') {
      this.deps.settingsStore.redoSettingsAction();
    }
  }

  async saveChanges() {
    const activeTab = this.getActiveTab();

    try {
      if (activeTab === 'Dataset') {
        await this.deps.datasetStore.saveDataset();
      } else if (activeTab === 'Tag Groups') {
        await this.deps.tagGroupsStore.saveTagGroups();
      } else if (activeTab === 'Settings') {
        // TODO: Make that it shows alert when trying to save through shortcut but there's no actual changes.
        await this.deps.settingsStore.saveSettings();
      }
    } catch (error) {
      this.deps.showAlert('error', (error as Error).message);
      this.logStore.addLog('error', `Error saving: ${(error as Error).message}`);
    }
  }

  async saveAllChanges() {
    try {
      await Promise.all([
        this.deps.datasetStore.saveDataset(),
        this.deps.tagGroupsStore.saveTagGroups(),
        this.deps.settingsStore.saveSettings()
      ]);
    } catch (error) {
      this.logStore.addLog('error', `Error saving all changes: ${(error as Error).message}`);
    }
  }

  async areAllChangesSaved() {
    const [datasetSaved, tagGroupsSaved, settingsSaved] = await Promise.all([
      this.deps.datasetStore.isDatasetSaved(),
      this.deps.tagGroupsStore.areTagGroupsSaved(),
      this.deps.settingsStore.areSettingsSaved()
    ]);

    return datasetSaved && tagGroupsSaved && settingsSaved;
  }

  private getActiveTab() {
    const checkedTab = document.querySelector(
      'input[type="radio"][name="editor_tabs"]:checked'
    ) as HTMLInputElement;

    return checkedTab?.ariaLabel as 'Dataset' | 'Tag Groups' | 'Settings' | null;
  }
}
