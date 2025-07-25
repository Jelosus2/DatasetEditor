import type { AlertType } from '@/composables/useAlert';
import type { useDatasetStore } from '@/stores/datasetStore';
import type { useTagGroupStore } from '@/stores/tagGroupStore';
import type { useSettingsStore } from '@/stores/settingsStore';
import { useLogStore } from '@/stores/logStore';

export interface AppControllerDependencies {
  datasetStore: ReturnType<typeof useDatasetStore>;
  tagGroupsStore: ReturnType<typeof useTagGroupStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  showAlert: (type: AlertType, message: string) => void;
}

export class AppController {
  private logStore = useLogStore();

  constructor(private deps: AppControllerDependencies) {}

  async initialize() {
    await this.deps.tagGroupsStore.loadTagGroups();
    await this.deps.settingsStore.loadSettings();
    this.deps.settingsStore.loadTheme();
  }

  async loadDataset(reload = false) {
    try {
      const loaded = await this.deps.datasetStore.loadDataset(reload);

      if (loaded) {
        if (this.deps.datasetStore.images.size > 0) {
          this.deps.showAlert('success', 'Dataset loaded');
        } else {
          this.deps.showAlert('error', 'Found no images to load');
        }
      } else if (this.deps.datasetStore.images.size === 0) {
        this.deps.showAlert('error', 'Found no images to load');
      }
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
        this.logStore.addLog('info', 'Saving dataset');
        await this.deps.datasetStore.saveDataset();
        this.deps.showAlert('success', 'Dataset saved successfully');
        this.logStore.addLog('info', 'Dataset saved');
      } else if (activeTab === 'Tag Groups') {
        this.logStore.addLog('info', 'Saving tag groups');
        await this.deps.tagGroupsStore.saveTagGroups();
        this.deps.showAlert('success', 'Tag groups saved successfully');
        this.logStore.addLog('info', 'Tag groups saved');
      } else if (activeTab === 'Settings') {
        this.logStore.addLog('info', 'Saving settings');
        await this.deps.settingsStore.saveSettings();
        this.deps.showAlert('success', 'Settings saved successfully');
        this.logStore.addLog('info', 'Settings saved');
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
