<script setup lang="ts">
import { APP_VERSION } from '@/version';

const arePreviewsEnabled = defineModel({ required: true, type: Boolean });
const emit = defineEmits(['load_dataset', 'undo', 'redo', 'save', 'reload_dataset']);
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
        </ul>
      </div>
    </div>
    <div class="navbar-end">
      <span class="rounded border border-gray-400 px-2 text-sm dark:border-base-content/20">
        Version {{ APP_VERSION }}
      </span>
    </div>
  </div>
</template>
