<script setup lang="ts"></script>

<template>
  <div class="navbar min-h-0.5 bg-base-300 shadow-sm">
    <div class="dropdown">
      <div tabindex="0" role="button" class="btn h-1 p-3 btn-sm btn-ghost hover:bg-[#323841]">
        File
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu z-1 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
      >
        <li>
          <a class="justify-between">Profile</a>
        </li>
        <li><a>Settings</a></li>
        <li><a onclick="my_modal_1.showModal()">Logout</a></li>
      </ul>
    </div>
    <div class="dropdown">
      <div tabindex="0" role="button" class="btn h-1 p-3 btn-sm btn-ghost hover:bg-[#323841]">
        Settings
      </div>
      <ul
        tabindex="0"
        class="dropdown-content menu z-1 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
      >
        <li>
          <a class="justify-between">Profile</a>
        </li>
        <li><a>Settings</a></li>
        <li><a>Logout</a></li>
      </ul>
    </div>
  </div>
</template>
