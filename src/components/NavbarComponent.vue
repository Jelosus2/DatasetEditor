<script setup lang="ts">
const arePreviewsEnabled = defineModel({ required: true, type: Boolean });
defineProps({
  os: {
    type: String,
    required: true,
  },
  theme: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['load_dataset', 'undo', 'redo', 'save']);

function changeTheme() {
  const app = document.querySelector('#app') as HTMLElement;
  const newTheme = app.dataset.theme === 'dark' ? 'winter' : 'dark';

  localStorage.setItem('theme', newTheme);
  app.dataset.theme = newTheme;
}
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
                <kbd v-if="os === 'mac'" class="kbd kbd-xs">&#8984;</kbd>
                <kbd v-else class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">O</kbd>
              </div>
            </div>
          </li>
          <li @click="emit('save')">
            <div class="justify-between">
              Save
              <div>
                <kbd v-if="os === 'mac'" class="kbd kbd-xs">&#8984;</kbd>
                <kbd v-else class="kbd kbd-xs">Ctrl</kbd>
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
                <kbd v-if="os === 'mac'" class="kbd kbd-xs">&#8984;</kbd>
                <kbd v-else class="kbd kbd-xs">Ctrl</kbd>
                +
                <kbd class="kbd kbd-xs">Z</kbd>
              </div>
            </div>
          </li>
          <li @click="emit('redo')">
            <div class="justify-between">
              Redo
              <div>
                <kbd v-if="os === 'mac'" class="kbd kbd-xs">&#8984;</kbd>
                <kbd v-else class="kbd kbd-xs">Ctrl</kbd>
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
    </div>
    <div class="navbar-end">
      <div class="dropdown mr-3">
        <label class="swap h-1 swap-rotate">
          <input type="checkbox" value="winter" @click="changeTheme" />
          <svg
            class="h-5 w-5 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            :class="{
              'swap-off': theme === 'winter',
              'swap-on': theme !== 'winter',
            }"
          >
            <path
              d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
            />
          </svg>
          <svg
            class="h-5 w-5 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            :class="{
              'swap-off': theme === 'dark',
              'swap-on': theme !== 'dark',
            }"
          >
            <path
              d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
            />
          </svg>
        </label>
      </div>
    </div>
  </div>
</template>
