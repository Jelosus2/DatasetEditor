import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TagGroupService } from '@/services/tagGroupService';

interface TagGroupChangeRecord {
  type: 'add_group' | 'remove_group' | 'add_tag' | 'remove_tag' | 'clear_groups';
  group?: string;
  tags?: string[];
  previousGroups?: Map<string, Set<string>>;
}

export const useTagGroupStore = defineStore('tagGroup', () => {
  const tagGroups = ref<Map<string, Set<string>>>(new Map());
  const tagGroupUndoStack = ref<TagGroupChangeRecord[]>([]);
  const tagGroupRedoStack = ref<TagGroupChangeRecord[]>([]);
  const tagGroupService = new TagGroupService();

  function pushTagGroupChange(change: TagGroupChangeRecord) {
    tagGroupUndoStack.value.push(change);
    tagGroupRedoStack.value = [];
  }

  function undoTagGroupAction() {
    const change = tagGroupUndoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_group') {
      tagGroups.value.delete(change.group!);
    } else if (change.type ==='remove_group') {
      tagGroups.value.set(change.group!, new Set(change.tags));
    } else if (change.type === 'add_tag') {
      for (const tag of change.tags!) {
        tagGroups.value.get(change.group!)?.delete(tag);
      }
    } else if (change.type === 'remove_tag') {
      for (const tag of change.tags!) {
        tagGroups.value.get(change.group!)?.add(tag);
      }
    } else if (change.type === 'clear_groups') {
      tagGroups.value = new Map(change.previousGroups!);
    }

    tagGroupRedoStack.value.push(change);
  }

  function redoTagGroupAction() {
    const change = tagGroupRedoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_group') {
      tagGroups.value.set(change.group!, new Set(change.tags));
    } else if (change.type ==='remove_group') {
      tagGroups.value.delete(change.group!);
    } else if (change.type === 'add_tag') {
      for (const tag of change.tags!) {
        tagGroups.value.get(change.group!)?.add(tag);
      }
    } else if (change.type === 'remove_tag') {
      for (const tag of change.tags!) {
        tagGroups.value.get(change.group!)?.delete(tag);
      }
    } else if (change.type === 'clear_groups') {
      tagGroups.value.clear();
    }

    tagGroupUndoStack.value.push(change);
  }

  function resetTagGroupStatus() {
    tagGroupUndoStack.value = [];
    tagGroupRedoStack.value = [];
  }

  async function loadTagGroups() {
    const result = await tagGroupService.loadTagGroups();
    if (result) {
      tagGroups.value = result;
      resetTagGroupStatus();
    }
  }

  async function saveTagGroups() {
    const tagGroupsObj = tagGroupService.tagGroupsToObject(tagGroups.value);
    await tagGroupService.saveTagGroup(tagGroupsObj);
  }

  async function areTagGroupsSaved() {
    const tagGroupsObj = tagGroupService.tagGroupsToObject(tagGroups.value);
    return tagGroupService.compareTagGroupChanges(tagGroupsObj);
  }

  return {
    tagGroupUndoStack,
    tagGroups,
    pushTagGroupChange,
    undoTagGroupAction,
    redoTagGroupAction,
    loadTagGroups,
    saveTagGroups,
    areTagGroupsSaved
  };
});
