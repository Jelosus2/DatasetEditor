import { onMounted, onUnmounted } from 'vue';

export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (event: KeyboardEvent) => void | Promise<void>;
  preventDefault?: boolean;
}

export interface ShortcutOptions {
  isEnabled?: () => boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], options: ShortcutOptions = {}) {
  const isEnabled = options.isEnabled ?? (() => true);

  const handleKeydown = async (event: KeyboardEvent) => {
    if (!isEnabled()) return;
    if (event.repeat) return;

    for (const shortcut of shortcuts) {
      const ctrlMatch = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;

      if (event.key === shortcut.key && ctrlMatch && shiftMatch && altMatch) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        await shortcut.handler(event);
        break;
      }
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
}
