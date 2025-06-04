import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useLogStore } from '@/stores/logStore';

export class TagGroupService {
  private ipc = useIpcRenderer([]);
  private logStore = useLogStore();

  async saveTagGroup(tagGroups: Record<string, string[]>) {
    return this.ipc.invoke('save_tag_group', tagGroups);
  }

  async loadTagGroups() {
    this.logStore.addLog('info', 'Loading tag groups');
    const res = await this.ipc.invoke<Map<string, Set<string>> | null>('load_tag_group');
    this.logStore.addLog('info', 'Tag groups loaded');
    return res;
  }

  async saveTagGroupFile(tagGroups: Record<string, string[]>) {
    this.logStore.addLog('info', 'Exporting tag group file');
    const res = await this.ipc.invoke('save_tag_group_file', tagGroups);
    this.logStore.addLog('info', 'Tag group file saved');
    return res;
  }

  async importTagGroup() {
    this.logStore.addLog('info', 'Importing tag group');
    const res = await this.ipc.invoke('import_tag_group');
    this.logStore.addLog('info', 'Tag group import complete');
    return res;
  }

  async compareTagGroupChanges(tagGroups: Record<string, string[]>) {
    return this.ipc.invoke<boolean>('compare_tag_group_changes', tagGroups);
  }

  tagGroupsToObject(tagGroups: Map<string, Set<string>>) {
    const obj: Record<string, string[]> = {};
    for (const [tagGroup, tags] of tagGroups.entries()) {
      obj[tagGroup] = [...tags];
    }
    return obj;
  }
}
