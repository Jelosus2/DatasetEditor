import { useIpcRenderer } from '@/composables/useIpcRenderer';

export class TagGroupService {
  private ipc = useIpcRenderer([]);

  async saveTagGroup(tagGroups: Record<string, string[]>) {
    return this.ipc.invoke('save_tag_group', tagGroups);
  }

  async loadTagGroups() {
    return this.ipc.invoke<Map<string, Set<string>> | null>('load_tag_group');
  }

  async saveTagGroupFile(tagGroups: Record<string, string[]>) {
    return this.ipc.invoke('save_tag_group_file', tagGroups);
  }

  async importTagGroup() {
    return this.ipc.invoke('import_tag_group');
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
