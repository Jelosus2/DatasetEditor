<script setup lang="ts">
import AutocompletionComponent from "@/components/AutocompletionComponent.vue";

import type { SettingsDefinition } from "../../shared/settings-schema";

import { useSettingsOperations } from "@/composables/useSettingsOperations";
import { useSettingsStore } from "@/stores/settingsStore";
import { reactive, ref, watchEffect } from "vue";

const activeSection = ref("");

const stringInputs = reactive<Record<string, string>>({});

const settingsStore = useSettingsStore();
const { search, sections, getValue, setValue, runAction } = useSettingsOperations();

watchEffect(() => {
    if (!activeSection.value && sections.value.length > 0)
        activeSection.value = sections.value[0][0];
});

watchEffect(() => {
    const current = settingsStore.getSetting("tagsIgnored");
    stringInputs["tagsIgnored"] = current.join(", ");
});

function slugify(value: string) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

function scrollToSection(section: string) {
    activeSection.value = section;
    document.getElementById(slugify(section))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function commitStringList(definition: SettingsDefinition) {
    setValue(definition, stringInputs[definition.key] ?? "");
}
</script>

<template>
    <div class="tab-content min-h-0 border-t border-base-300 bg-base-100">
        <div class="mx-auto h-full max-w-370 px-10">
            <div class="flex h-full">
                <aside class="w-72 border-x border-base-content/20 p-4 flex flex-col">
                    <div class="space-y-4">
                        <input
                            class="input w-full outline-none!"
                            placeholder="Search settings..."
                            v-model="search"
                        />
                        <div class="text-sm font-semibold uppercase text-base-content/60">
                            Sections
                        </div>
                        <ul class="menu rounded-box">
                            <li v-for="[section] in sections" :key="section">
                                <a :class="{ active: activeSection === section }" @click="scrollToSection(section)">
                                    {{ section }}
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="mt-auto pt-4 border-t border-base-content/30">
                        <button
                            class="btn btn-accent btn-outline w-full"
                            :disabled="!settingsStore.hasChanges"
                            @click="settingsStore.saveSettings()"
                        >
                            Save
                        </button>
                    </div>
                </aside>
                <div class="flex-1 overflow-auto p-6 pb-24">
                    <section
                        v-for="[section, fields] in sections"
                        :key="section"
                        :id="slugify(section)"
                        class="mb-10 space-y-4"
                    >
                        <h2 class="text-xl font-semibold">{{ section }}</h2>
                        <div class="space-y-3">
                            <div
                                v-for="field in fields"
                                :key="field.key"
                                class="rounded-box border border-base-content/10 bg-base-200/40 p-4"
                            >
                                <div class="flex flex-row items-center justify-between p-3">
                                    <div>
                                        <div class="font-medium">
                                            {{ field.label }}
                                            <span v-if="field.requiresRestart" class="badge badge-warning badge-outline ml-2">
                                                Restart required
                                            </span>
                                        </div>
                                        <div v-if="field.description" class="text-sm text-base-content/70">
                                            {{ field.description }}
                                        </div>
                                    </div>

                                    <!-- boolean -->
                                    <label v-if="field.type === 'boolean'" class="label cursor-pointer justify-end gap-4">
                                        <input
                                            type="checkbox"
                                            class="toggle"
                                            :checked="getValue(field) as boolean"
                                            @change="setValue(field, ($event.target as HTMLInputElement).checked)"
                                        />
                                    </label>

                                    <!-- select -->
                                    <div v-else-if="field.type === 'select'" class="w-64">
                                        <select
                                            class="select w-full outline-none!"
                                            :value="getValue(field)"
                                            @change="setValue(field, ($event.target as HTMLSelectElement).value)"
                                        >
                                            <option v-for="option in field.options" :key="option.value" :value="option.value">
                                                {{ option.label }}
                                            </option>
                                        </select>
                                    </div>

                                    <!-- number -->
                                    <div v-else-if="field.type === 'number'" class="w-40">
                                        <input
                                            type="number"
                                            class="input w-full outline-none!"
                                            :value="getValue(field)"
                                            @input="setValue(field, ($event.target as HTMLInputElement).value)"
                                        />
                                    </div>

                                    <!-- action -->
                                    <div v-else-if="field.type === 'action'">
                                        <button class="btn btn-outline" @click="runAction(field)">
                                            {{ field.label }}
                                        </button>
                                    </div>
                                </div>

                                <!-- tagsIgnored (string[]) -->
                                <div v-if="field.type === 'string[]'" class="mt-3">
                                    <AutocompletionComponent
                                        v-model="stringInputs[field.key]"
                                        class="textarea w-full resize-y outline-none!"
                                        :rows="3"
                                        :id="`settings-${field.key}`"
                                        :textarea="true"
                                        :multiple="true"
                                        :placeholder="'tag1, tag2, tag3...'"
                                        @on-blur="commitStringList(field)"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    </div>
</template>
