<script setup lang="ts">
import AutocompletionInput from "@/components/AutocompletionInput.vue";
import AlertModal from "@/components/AlertModal.vue";

import type { SettingsDefinition } from "../../shared/settings-schema";

import { useSettingsOperations } from "@/composables/useSettingsOperations";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAlert } from "@/composables/useAlert";
import { reactive, ref, computed, watchEffect, watch, onMounted } from "vue";

const activeSection = ref("");

const stringInputs = reactive<Record<string, string>>({});

const settingsStore = useSettingsStore();
const settingsOperations = useSettingsOperations();
const { showAlert } = useAlert();

const isRestartModalOpen = computed(() => settingsStore.showRestartPrompt);

watchEffect(() => {
    if (!activeSection.value && settingsOperations.sections.value.length > 0)
        activeSection.value = settingsOperations.sections.value[0][0];
});

watchEffect(() => {
    const current = settingsStore.getSetting("tagsIgnored");
    stringInputs["tagsIgnored"] = current.join(", ");
});

watchEffect(() => {
    const errorCount = Object.values(settingsOperations.directoryErrors).filter(Boolean).length;
    settingsStore.directoryErrorsCount = errorCount;
});

watch(() => settingsStore.buildSettings(true), async (newSettings) => {
    for (const definition of settingsStore.schema) {
        if (definition.type !== "directory")
            continue;

        const storeValue = String(newSettings[definition.key] ?? "");
        const localValue = settingsOperations.directoryInputs[definition.key];

        if (settingsStore.isApplying || (storeValue !== localValue && localValue !== undefined)) {
            settingsOperations.directoryInputs[definition.key] = storeValue;

            await settingsOperations.validateDirectory(definition);
        }
    }
}, { deep: true });

function slugify(value: string) {
    return value.toLowerCase().replace(/\s+/g, "-");
}

function scrollToSection(section: string) {
    activeSection.value = section;
    document.getElementById(slugify(section))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function commitStringList(definition: SettingsDefinition) {
    settingsOperations.setValue(definition, stringInputs[definition.key] ?? "");
}

function recordShortcut(field: SettingsDefinition, event: KeyboardEvent) {
    if (event.key === "Escape") {
        (event.target as HTMLInputElement).blur();
        return;
    }

    const combo = settingsOperations.formatShortcut(event);
    if (!combo)
        return;

    const result = settingsStore.trySetShortcut(field.key, combo);
    if (!result.ok) {
        const conflictLabel = settingsStore.schema.find((def) => def.key === result.conflictKey)?.label ?? "another shortcut";
        showAlert("error", `Shortcut already used by "${conflictLabel}"`);
    }
}

function closeRestartModal() {
    settingsStore.dismissRestartPrompt();
}

async function restart() {
    await settingsStore.restartApp();
}

onMounted(() => {
    settingsStore.schema.forEach((definition) => {
        if (definition.type === "directory" && settingsOperations.directoryInputs[definition.key] === undefined)
            settingsOperations.directoryInputs[definition.key] = String(settingsStore.getSetting(definition.key) ?? "");
    });
});
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
                            v-model="settingsOperations.search.value"
                        />
                        <div class="text-sm font-semibold uppercase text-base-content/60">
                            Sections
                        </div>
                        <ul class="menu rounded-box">
                            <li v-for="[section] in settingsOperations.sections.value" :key="section">
                                <a :class="{ active: activeSection === section }" @click="scrollToSection(section)">
                                    {{ section }}
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="mt-auto pt-4 border-t border-base-content/30">
                        <button
                            class="btn btn-accent btn-outline w-full"
                            :disabled="!settingsStore.hasChanges || settingsStore.shortcutConflicts.size > 0 || settingsStore.directoryErrorsCount > 0"
                            @click="settingsStore.saveSettings()"
                        >
                            Save
                        </button>
                    </div>
                </aside>
                <div class="flex-1 overflow-auto p-6 pb-24">
                    <section
                        v-for="[section, fields] in settingsOperations.sections.value"
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
                                            :checked="settingsOperations.getValue(field) as boolean"
                                            @change="settingsOperations.setValue(field, ($event.target as HTMLInputElement).checked)"
                                        />
                                    </label>

                                    <!-- select -->
                                    <div v-else-if="field.type === 'select'" class="w-64">
                                        <select
                                            class="select w-full outline-none!"
                                            :value="settingsOperations.getValue(field)"
                                            @change="settingsOperations.setValue(field, ($event.target as HTMLSelectElement).value)"
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
                                            :value="settingsOperations.getValue(field)"
                                            @input="settingsOperations.setValue(field, ($event.target as HTMLInputElement).value)"
                                        />
                                    </div>

                                    <!-- action -->
                                    <div v-else-if="field.type === 'action'">
                                        <button class="btn btn-outline" @click="settingsOperations.runAction(field)">
                                            {{ field.label }}
                                        </button>
                                    </div>

                                    <!-- shortcut -->
                                    <div v-else-if="field.type === 'shortcut'" class="w-64">
                                        <input
                                            readonly
                                            class="input w-full outline-none!"
                                            :class="{ 'border border-error': settingsStore.shortcutConflicts.has(field.key) }"
                                            :value="settingsOperations.getValue(field)"
                                            @keydown.stop.prevent="recordShortcut(field, $event)"
                                        />
                                        <div class="text-sm text-base-content/60 mt-1">Press keys to set (Escape to cancel)</div>
                                    </div>

                                    <!-- directory -->
                                    <div v-else-if="field.type === 'directory'" class="w-110">
                                        <div class="flex items-center gap-2">
                                            <input
                                                class="input w-full outline-none!"
                                                placeholder="Type a path..."
                                                :class="{ 'input-error': settingsOperations.directoryErrors[field.key] }"
                                                v-model="settingsOperations.directoryInputs[field.key]"
                                                @blur="settingsOperations.validateDirectory(field)"
                                            />
                                            <button class="btn btn-outline" @click="settingsOperations.pickDirectory(field)">Browse</button>
                                        </div>
                                        <div v-if="settingsOperations.directoryErrors[field.key]" class="text-error text-sm mt-1">
                                            {{ settingsOperations.directoryErrors[field.key] }}
                                        </div>
                                    </div>
                                </div>

                                <!-- tagsIgnored (string[]) -->
                                <div v-if="field.type === 'string[]'" class="mt-3 relative">
                                    <AutocompletionInput
                                        v-model="stringInputs[field.key]"
                                        class="textarea w-full resize-y outline-none!"
                                        placeholder="tag1, tag2, tag3..."
                                        :textarea="true"
                                        :rows="3"
                                        :multiple="true"
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
    <AlertModal
        :open="isRestartModalOpen"
        title="Restart required"
        message="You changed a setting that requires a restart. Restart now or apply it next time you open the app."
        confirm-text="Restart now"
        cancel-text="Later"
        confirm-class="btn btn-error btn-outline"
        @cancel="closeRestartModal"
        @confirm="restart"
        @update:open="(value) => !value && closeRestartModal()"
    />
</template>
