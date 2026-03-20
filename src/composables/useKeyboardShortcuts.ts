import type { ShortcutConfig, ShortcutOptions } from "@/types/shortcut";

import { useSettingsStore } from "@/stores/settingsStore";
import { onMounted, onUnmounted, onActivated, onDeactivated } from "vue";

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[] | (() => ShortcutConfig[]), options: ShortcutOptions = {}) {
    const settingsStore = useSettingsStore();
    const isEnabled = options.isEnabled ?? (() => true);
    let subscribed = false;

    const handleKeydown = async (event: KeyboardEvent) => {
        if (!isEnabled()) return;
        if (event.repeat) return;

        const list = typeof shortcuts === "function" ? shortcuts() : shortcuts;

        for (const shortcut of list) {
            const settingKey = settingsStore.shortcutKeys.find(key => settingsStore.getSetting(key) === shortcut.combo);
            if (settingKey && settingsStore.shortcutConflicts.has(settingKey))
                continue;

            if (settingsStore.matchesShortcut(shortcut.combo, event)) {
                if (shortcut.preventDefault)
                    event.preventDefault();

                await shortcut.handler(event);
                break;
            }
        }
    }

    function subscribe() {
        if (subscribed)
            return;

        document.addEventListener("keydown", handleKeydown);
        subscribed = true;
    }

    function unsubscribe() {
        if (!subscribed)
            return;

        document.removeEventListener("keydown", handleKeydown);
        subscribed = false;
    }

    onMounted(subscribe);
    onActivated(subscribe);
    onDeactivated(unsubscribe);
    onUnmounted(unsubscribe);
}
