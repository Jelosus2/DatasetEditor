import type { AlertType } from '@/composables/useAlert';
import type { useDatasetStore } from '@/stores/datasetStore';
import type { useTagGroupStore } from '@/stores/tagGroupStore';
import type { useSettingsStore } from '@/stores/settingsStore';

export interface AppControllerDependencies {
  datasetStore: ReturnType<typeof useDatasetStore>;
  tagGroupsStore: ReturnType<typeof useTagGroupStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  showAlert: (type: AlertType, message: string) => void;
}

export class AppController {
  constructor(private deps: AppControllerDependencies) {}

  async initialize() {
    await this.deps.tagGroupsStore.loadTagGroups();
    await this.deps.settingsStore.loadSettings();
    this.deps.settingsStore.loadTheme();
  }

  async loadDataset(reload = false) {
    try {
      await this.deps.datasetStore.loadDataset(reload);
    } catch (error) {
      this.deps.showAlert('error', 'Failed to load dataset');
      console.error('Error loading dataset:', error);
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
      this.deps.tagGroupsStore.undoTagGroupAction();
    } else if (activeTab === 'Settings') {
      this.deps.settingsStore.undoSettingsAction();
    }
  }

  redoAction() {
    const activeTab = this.getActiveTab();

    if (activeTab === 'Dataset') {
      this.deps.datasetStore.redoDatasetAction();
    } else if (activeTab === 'Tag Groups') {
      this.deps.tagGroupsStore.redoTagGroupAction();
    } else if (activeTab === 'Settings') {
      this.deps.settingsStore.redoSettingsAction();
    }
  }

  async saveChanges() {
    const activeTab = this.getActiveTab();

    try {
      if (activeTab === 'Dataset') {
        await this.deps.datasetStore.saveDataset();
        this.deps.showAlert('success', 'Dataset saved successfully');
      } else if (activeTab === 'Tag Groups') {
        await this.deps.tagGroupsStore.saveTagGroups();
        this.deps.showAlert('success', 'Tag groups saved successfully');
      } else if (activeTab === 'Settings') {
        await this.deps.settingsStore.saveSettings();
        this.deps.showAlert('success', 'Settings saved successfully');
      }
    } catch (error) {
      this.deps.showAlert('error', (error as Error).message);
      console.error('Error saving:', error);
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
      console.error('Error saving all changes:', error);
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
