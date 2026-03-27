import { useEffect, useCallback } from 'react';

type KeyCombo = string; // e.g., 'ctrl+s', 'enter', 'esc', 'shift+a'
type Handler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
  combo: KeyCombo;
  handler: Handler;
  description?: string;
  disabled?: boolean;
  global?: boolean; // If true, triggers even when input is focused (use carefully)
}

/**
 * Hook to handle keyboard shortcuts.
 * 
 * @param shortcuts Array of shortcut configurations
 * @param deps Dependencies array to re-bind listeners (optional)
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[], deps: any[] = []) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if the target is an input element
    const target = event.target as HTMLElement;
    const isInput = target.matches('input, textarea, select, [contenteditable]');

    shortcuts.forEach(({ combo, handler, disabled, global }) => {
      if (disabled) return;

      const parts = combo.toLowerCase().split('+').map(p => p.trim());
      const mainKey = parts[parts.length - 1];
      
      // Check modifiers
      const needsCtrl = parts.includes('ctrl');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt');
      const needsMeta = parts.includes('meta') || parts.includes('cmd');

      // Modifiers match?
      if (
        event.ctrlKey !== needsCtrl ||
        event.shiftKey !== needsShift ||
        event.altKey !== needsAlt ||
        event.metaKey !== needsMeta
      ) {
        return;
      }

      // Main key match?
      // Handle special keys mapping if necessary, but event.key is usually good.
      // 'Esc' vs 'Escape', 'Del' vs 'Delete'
      let keyMatch = false;
      if (mainKey === 'esc') keyMatch = event.key === 'Escape';
      else if (mainKey === 'del') keyMatch = event.key === 'Delete';
      else keyMatch = event.key.toLowerCase() === mainKey;

      if (keyMatch) {
         // If inside input and not global, skip.
         // Usually modifier keys (Ctrl+S) are desired globally, but single keys (D) are not.
         // We'll trust the 'global' flag or the nature of the shortcut.
         // Default behavior: Ignore single keys in inputs, allow modifiers unless specified otherwise?
         // Safer: Explicit 'global' flag required to work in inputs.
         // BUT, Ctrl+Enter in a textarea to submit is common.
         
         const hasModifiers = needsCtrl || needsAlt || needsMeta;
         
         if (isInput && !global && !hasModifiers) {
             return; // Don't trigger 'd' when typing 'door'
         }
         
         // Even with modifiers, we might want to respect default browser behavior unless prevented
         // We'll prevent default if matched.
         event.preventDefault();
         handler(event);
      }
    });
  }, [shortcuts, ...deps]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
