import { defineStore } from 'pinia';
import { ref } from 'vue';

interface TagGroupChangeRecord {
  type: 'add_tag' | 'remove_tag';
  group: string;
  tags: string[];
  previousState?: Map<string, Set<string>>;
}

export const useTagGroupStore = defineStore('tagGroup', () => {
  const tagGroups = ref<Map<string, Set<string>>>(new Map());
  const tagGroupUndoStack = ref<TagGroupChangeRecord[]>([]);
  const tagGroupRedoStack = ref<TagGroupChangeRecord[]>([]);

  function pushTagGroupChange(change: TagGroupChangeRecord) {
    tagGroupUndoStack.value.push(change);
    tagGroupRedoStack.value = [];
  }

  function undoTagGroupAction() {
    const change = tagGroupUndoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_tag') {
      for (const tag of change.tags) {
        tagGroups.value.get(change.group)?.delete(tag);
      }

      tagGroupRedoStack.value.push({
        type: 'add_tag',
        group: change.group,
        tags: change.tags,
      });
    } else if (change.type === 'remove_tag') {
      for (const tag of change.tags) {
        tagGroups.value.get(change.group)?.add(tag);
      }

      tagGroupRedoStack.value.push({
        type: 'remove_tag',
        group: change.group,
        tags: change.tags,
      });
    }
  }

  function redoTagGroupAction() {
    const change = tagGroupRedoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_tag') {
      for (const tag of change.tags) {
        tagGroups.value.get(change.group)?.add(tag);
      }

      tagGroupUndoStack.value.push({
        type: 'add_tag',
        group: change.group,
        tags: change.tags,
      });
    } else if (change.type === 'remove_tag') {
      for (const tag of change.tags) {
        tagGroups.value.get(change.group)?.delete(tag);
      }

      tagGroupUndoStack.value.push({
        type: 'remove_tag',
        group: change.group,
        tags: change.tags,
      });
    }
  }

  return {
    tagGroups,
    pushTagGroupChange,
    undoTagGroupAction,
    redoTagGroupAction,
  };
});
