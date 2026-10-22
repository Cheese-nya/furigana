'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export const THEME_STORAGE_KEY = 'furigana_dark_mode';
export const DARK_THEME_BG = '#000000';
export const LIGHT_THEME_BG = '#F2F2F7';

interface NativeThemeWindow {
  webkit?: {
    messageHandlers?: {
      furiganaTheme?: {
        postMessage?: (msg: { bg: string; isDark: boolean; auto?: boolean }) => void;
      };
    };
  };
  AndroidBridge?: {
    syncTheme?: (bg: string, isDark: boolean) => void;
  };
}

export type ThemeMode = 'auto' | 'light' | 'dark';

const listeners = new Set<() => void>();
let memoryFallbackMode: ThemeMode | null = null;
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  const nativeDark = (window as unknown as { __furiganaSystemDark?: unknown }).__furiganaSystemDark;
  if (typeof nativeDark === 'boolean') return nativeDark;
  return !!window.matchMedia?.(SYSTEM_DARK_QUERY).matches;
}

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
  // 'auto' follows the system appearance live.
  const media = window.matchMedia?.(SYSTEM_DARK_QUERY);
  media?.addEventListener?.('change', listener);
  window.addEventListener('furigana-system-theme', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
    media?.removeEventListener?.('change', listener);
    window.removeEventListener('furigana-system-theme', listener);
  };
}

function readMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'auto') return 'auto';
      if (stored !== null) return stored === '1' ? 'dark' : 'light';
    }
  } catch {
    // Ignore storage read failures
  }
  // Nothing chosen yet: follow the system appearance, like the mockup.
  return memoryFallbackMode ?? 'auto';
}

function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'auto' && systemPrefersDark());
}

function getSnapshot(): boolean {
  return resolveDark(readMode());
}

function getModeSnapshot(): ThemeMode {
  return readMode();
}

function getServerSnapshot(): boolean {
  return false;
}

function getServerModeSnapshot(): ThemeMode {
  return 'light';
}

/** `followsSystem` tells the native shells to stop pinning an appearance ("自动"). */
export function syncThemeSideEffects(isDark: boolean, persist = true, followsSystem = false): void {
  try {
    const bg = isDark ? DARK_THEME_BG : LIGHT_THEME_BG;
    if (persist) {
      memoryFallbackMode = isDark ? 'dark' : 'light';
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
      win.webkit?.messageHandlers?.furiganaTheme?.postMessage?.({ bg, isDark, auto: followsSystem });
      win.AndroidBridge?.syncTheme?.(bg, isDark);
    }
  } catch {
    // Ignore storage or DOM errors in restricted environments
  }
}

export function useThemeMode() {
  const darkMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const themeMode = useSyncExternalStore(subscribe, getModeSnapshot, getServerModeSnapshot);

  useEffect(() => {
    syncThemeSideEffects(darkMode, false, themeMode === 'auto');
  }, [darkMode, themeMode]);

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

  const setThemeMode = useCallback((mode: ThemeMode) => {
    memoryFallbackMode = mode;
    if (mode === 'auto') {
      // Apply the system appearance without pinning it, then remember "auto".
      syncThemeSideEffects(systemPrefersDark(), false, true);
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, 'auto');
      } catch {
        // Ignore storage write failures
      }
    } else {
      syncThemeSideEffects(mode === 'dark', true);
    }
    emitChange();
  }, []);

  return {
    darkMode,
    themeMode,
    setThemeMode,
    setDarkMode,
    toggleDarkMode,
  };
}

