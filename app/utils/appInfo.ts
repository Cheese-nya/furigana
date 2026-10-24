import type { Distribution, Platform } from './updateTypes';

interface PlatformWindow {
  AndroidBridge?: unknown;
  pywebview?: unknown;
  Capacitor?: unknown;
  navigator?: { userAgent?: string };
  location?: { search?: string };
}

/** Version of this build, injected from package.json by next.config.ts. */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

/** Store builds hide self-update. Set NEXT_PUBLIC_DISTRIBUTION at build time; default is the website build. */
export const DISTRIBUTION: Distribution =
  process.env.NEXT_PUBLIC_DISTRIBUTION === 'play' || process.env.NEXT_PUBLIC_DISTRIBUTION === 'appstore'
    ? process.env.NEXT_PUBLIC_DISTRIBUTION
    : 'website';

export function getPlatform(target: PlatformWindow | undefined = typeof window === 'undefined' ? undefined : (window as unknown as PlatformWindow)): Platform {
  if (!target) return 'web';
  if (target.AndroidBridge) return 'android';
  // desktop_runner opens the page as /?desktop=1; window.pywebview itself can appear a moment after load.
  if (target.pywebview || /[?&]desktop=1(?:&|$)/.test(target.location?.search ?? '')) return 'desktop';
  if (target.Capacitor || /iPhone|iPad|iPod/i.test(target.navigator?.userAgent ?? '')) return 'ios';
  return 'web';
}
