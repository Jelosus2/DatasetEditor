<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, computed } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';

const isChangingFile = ref(false);

const settingsStore = useSettingsStore();

const tagsIgnoredText = computed({
  get: () => settingsStore.tagsIgnored.join(', '),
  set: (value: string) => {
    settingsStore.tagsIgnored = value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }
});

async function changeAutocompleteFile() {
  isChangingFile.value = true;
  await settingsStore.changeAutocompleteFile();
  isChangingFile.value = false;
}
</script>

<template>
  <input type="radio" name="editor_tabs" class="tab" aria-label="Settings" />
  <div class="tab-content h-full overflow-auto border-0 border-t border-base-300 bg-base-100 p-6">
    <div class="flex flex-col items-center justify-center">
      <div class="w-3xl space-y-8">
        <div class="space-y-2">
          <h2 class="text-xl font-semibold">Appearance</h2>
          <p class="text-sm text-base-content/70">Whether to show tag count or not.</p>
          <div class="form-control w-full max-w-xs py-2">
            <label class="label cursor-pointer justify-start gap-4">
              <input type="checkbox" class="toggle" v-model="settingsStore.showTagCount" />
              <span class="label-text">Tag Count</span>
            </label>
          </div>
          <p class="text-sm text-base-content/70">Adjust the visual theme of the application.</p>
          <div class="form-control w-full max-w-xs">
            <label class="label">
              <span class="label-text">Theme</span>
            </label>
            <select
              class="select-bordered select !outline-none"
              v-model="settingsStore.theme"
              @change="settingsStore.loadTheme(($event.target as HTMLSelectElement).value)"
            >
              <option value="winter">Winter (Light)</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
        <div class="divider"></div>
        <div class="space-y-2">
          <h2 class="text-xl font-semibold">General</h2>
          <p class="text-sm text-base-content/70">Enable autocompletion or not.</p>
          <div class="space-y-4 pt-2">
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-4">
                <input type="checkbox" class="toggle" v-model="settingsStore.autocomplete" />
                <span class="label-text">Autocomplete</span>
              </label>
            </div>
            <div v-if="settingsStore.autocomplete" class="w-full max-w-xs">
              <label class="label">
                <span>Autocompletion file</span>
              </label>
              <div>
                <button class="btn btn-sm btn-outline btn-info" @click="changeAutocompleteFile">
                  {{ settingsStore.autocompleteFile.split(/\/|\\/).pop() || 'None' }}
                </button>
                <span v-if="isChangingFile" class="loading ml-2 loading-spinner"></span>
              </div>
            </div>
            <div class="w-full max-w-md">
              <label class="label">
                <span class="label-text">Ignored tags</span>
              </label>
              <p class="text-sm text-base-content/70 mb-2">
                Tags to ignore in the autotagging process. Separate multiple tags with commas.
              </p>
              <div class="relative">
                <AutocompletionComponent
                  v-model="tagsIgnoredText"
                  class="textarea w-full resize-y !outline-none"
                  :rows="3"
                  :id="'ignore-tags-list'"
                  :textarea="true"
                  :multiple="true"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="divider"></div>
      </div>
    </div>
  </div>
</template>
