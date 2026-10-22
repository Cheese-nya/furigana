'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export const THEME_STORAGE_KEY = 'furigana_dark_mode';
export const DARK_THEME_BG = '#000000';
export const LIGHT_THEME_BG = '#F2F2F7';

interface NativeThemeWindow {
  webkit?: {
    messageHandlers?: {
      furiganaTheme?: {
        postMessage?: (msg: { bg: string; isDark: boolean }) => void;
      };
    };
  };
  AndroidBridge?: {
    syncTheme?: (bg: string, isDark: boolean) => void;
  };
}

const listeners = new Set<() => void>();
let memoryFallbackDark = false;

function emitChange(): void {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {
      listeners.delete(listener);
    };
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      listener();
    }
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

function getSnapshot(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored !== null) {
        return stored === '1';
      }
    }
  } catch {
    // Ignore storage read failures
  }
  return memoryFallbackDark;
}

function getServerSnapshot(): boolean {
  return false;
}

export function syncThemeSideEffects(isDark: boolean, persist = true): void {
  try {
    const bg = isDark ? DARK_THEME_BG : LIGHT_THEME_BG;
    if (persist) {
      memoryFallbackDark = isDark;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, isDark ? '1' : '0');
      }
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.documentElement.style.setProperty('--bg-primary', bg);
      document.documentElement.style.backgroundColor = bg;
      if (document.body) {
        document.body.style.backgroundColor = bg;
      }
      document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
        meta.removeAttribute('media');
        meta.setAttribute('content', bg);
      });
    }
    if (typeof window !== 'undefined') {
      const win = window as unknown as NativeThemeWindow;
      win.webkit?.messageHandlers?.furiganaTheme?.postMessage?.({ bg, isDark });
      win.AndroidBridge?.syncTheme?.(bg, isDark);
    }
  } catch {
    // Ignore storage or DOM errors in restricted environments
  }
}

export function useThemeMode() {
  const darkMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    syncThemeSideEffects(darkMode, false);
  }, [darkMode]);

  const setDarkMode = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(getSnapshot()) : value;
    syncThemeSideEffects(next, true);
    emitChange();
  }, []);

  const toggleDarkMode = useCallback(() => {
    const next = !getSnapshot();
    syncThemeSideEffects(next, true);
    emitChange();
  }, []);

  return {
    darkMode,
    setDarkMode,
    toggleDarkMode,
  };
}

