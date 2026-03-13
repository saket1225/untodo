import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Keyboard shortcuts hook for web/desktop and hardware keyboard support.
 * On web, attaches keydown listeners.
 * On native, we rely on React Native's built-in hardware keyboard support
 * which dispatches keyDown events on Android/iOS when a hardware keyboard
 * is connected. For native, this is a no-op — hardware keyboard shortcuts
 * are handled via onKeyPress on focusable components.
 */
interface ShortcutHandlers {
  onNewTask?: () => void;
  onSubmit?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onToggleSelected?: () => void;
  onDeleteSelected?: () => void;
}

export function useKeyboardShortcuts(
  handlers: ShortcutHandlers,
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't intercept when user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Enter' && handlers.onSubmit) {
          return;
        }
        return;
      }

      // Cmd/Ctrl+N for new task
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handlers.onNewTask?.();
        return;
      }

      switch (e.key) {
        case 'n':
          e.preventDefault();
          handlers.onNewTask?.();
          break;
        case 'Enter':
          e.preventDefault();
          handlers.onSubmit?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlers.onNavigateUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlers.onNavigateDown?.();
          break;
        case ' ':
          e.preventDefault();
          handlers.onToggleSelected?.();
          break;
        case 'd':
          e.preventDefault();
          handlers.onDeleteSelected?.();
          break;
      }
    },
    [handlers, enabled]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    window.addEventListener('keydown', handleKeyDown as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [handleKeyDown]);
}
