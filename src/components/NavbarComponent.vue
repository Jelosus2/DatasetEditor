<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { UpdateService } from '@/services/updateService';
import { APP_VERSION } from '@/version';

import UpdateCheckIcon from '@/assets/icons/update-check.svg';
import UpdateDownloadIcon from '@/assets/icons/update-download.svg';
import UpdateRestartIcon from '@/assets/icons/update-restart.svg';

const arePreviewsEnabled = defineModel({ required: true, type: Boolean });
const emit = defineEmits(['load_dataset', 'undo', 'redo', 'save', 'reload_dataset', 'trigger_alert']);

const updateService = new UpdateService();
const updateState = ref<'check' | 'download' | 'restart'>('check');
const isDownloading = ref(false);
const areUpdatesAvailable = ref(true);

onMounted(async () => {
  window.ipcRenderer.receive('update_available', () => {
    updateState.value = 'download';
  });
  window.ipcRenderer.receive('update_progress', () => {
    isDownloading.value = true;
  });
  window.ipcRenderer.receive('update_downloaded', () => {
    isDownloading.value = false;
    updateState.value = 'restart';
  });
  window.ipcRenderer.receive('update_error', () => {
    emit('trigger_alert', 'error', 'Failed to update, check the logs for more information');
    isDownloading.value = false;
  });

  areUpdatesAvailable.value = await updateService.areUpdatesAvailable();
});

onUnmounted(() => {
  window.ipcRenderer.unsubscribe('update_available');
  window.ipcRenderer.unsubscribe('update_progress');
  window.ipcRenderer.unsubscribe('update_downloaded');
  window.ipcRenderer.unsubscribe('update_error');
});

async function handleUpdateAction() {
  if (updateState.value === 'check') {
    const update = await updateService.checkForUpdates();
    if (update && APP_VERSION === update.updateInfo.version) {
      emit('trigger_alert', 'info', 'No updates available');
    }
  }
  else if (updateState.value === 'download') {
    isDownloading.value = true;
    updateService.downloadUpdate();
  }
  else updateService.installUpdate();
}

const updateInfo = computed(() => {
  if (updateState.value === 'check') return { value: 'Check for Updates', class: 'btn-primary' };
  if (updateState.value === 'download') return { value: 'Download Update', class: 'btn-success' };
  return { value: 'Restart to Install', class: 'btn-warning' };
});
</script>

<template>
  <div class="navbar min-h-0.5 shadow-sm dark:shadow-md">
    <div class="navbar-start">
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn h-1 p-3 btn-sm btn-ghost dark:hover:bg-[#323841]"
        >
          File
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu z-1 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
        >
          <li @click="emit('load_dataset')">
            <div class="justify-between">
              Load Dataset
              <div>
                <kbd class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">O</kbd>
              </div>
            </div>
          </li>
          <li @click="emit('reload_dataset')">
            <div class="justify-between">
              Reload Dataset
              <div>
                <kbd class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">R</kbd>
              </div>
            </div>
          </li>
          <li @click="emit('save')">
            <div class="justify-between">
              Save
              <div>
                <kbd class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">S</kbd>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn h-1 p-3 btn-sm btn-ghost dark:hover:bg-[#323841]"
        >
          Edit
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu z-1 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
        >
          <li @click="emit('undo')">
            <div class="justify-between">
              Undo
              <div>
                <kbd class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">Z</kbd>
              </div>
            </div>
          </li>
          <li @click="emit('redo')">
            <div class="justify-between">
              Redo
              <div>
                <kbd class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">Y</kbd>
              </div>
            </div>
          </li>
        </ul>
      </div>
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn h-1 p-3 btn-sm btn-ghost dark:hover:bg-[#323841]"
        >
          View
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu z-1 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
        >
          <li>
            <div @click.self="arePreviewsEnabled = !arePreviewsEnabled">
              <input v-model="arePreviewsEnabled" type="checkbox" class="toggle toggle-xs" />
              Image Previews
            </div>
          </li>
        </ul>
      </div>
      <div class="dropdown">
        <div
          tabindex="0"
          role="button"
          class="btn h-1 p-3 btn-sm btn-ghost dark:hover:bg-[#323841]"
        >
          Tools
        </div>
        <ul
          tabindex="0"
          class="dropdown-content menu z-1 w-70 menu-sm rounded-box bg-base-100 p-2 shadow"
        >
          <li>
            <label for="autotagger_modal">Autotag Images</label>
          </li>
          <li>
            <label for="background_color_modal">Add background color to selected images</label>
          </li>
          <li>
            <label for="danbooru_wiki_modal">Search Danbooru Wiki</label>
          </li>
          <li>
            <label for="crop_image_modal">Crop image</label>
          </li>
        </ul>
      </div>
    </div>
    <div class="navbar-center">
      <button
        class="btn btn-xs"
        :class="updateInfo.class"
        @click="handleUpdateAction"
        :disabled="!areUpdatesAvailable || isDownloading"
      >
        <template v-if="isDownloading">
          <span class="loading loading-spinner mr-1 h-4 w-4"></span>
          <span>Downloading...</span>
        </template>
        <template v-else>
          <UpdateCheckIcon v-if="updateState === 'check'" class="h-4 w-4 mr-1" />
          <UpdateDownloadIcon v-else-if="updateState === 'download'" class="h-4 w-4 mr-1" />
          <UpdateRestartIcon v-else class="h-4 w-4 mr-1" />
          <span>{{ updateInfo.value }}</span>
        </template>
      </button>
    </div>
    <div class="navbar-end">
      <span class="rounded border border-gray-400 px-2 text-sm dark:border-base-content/20">
        Version {{ APP_VERSION }}
      </span>
    </div>
  </div>
</template>
