// Standalone interface so this file compiles with `npx tsc --noEmit` even when
// `@capacitor/cli` is not installed locally. If you add @capacitor/cli, you may
// replace this interface with `import type { CapacitorConfig } from '@capacitor/cli';`.
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
  };
  ios?: {
    contentInset?: 'automatic' | 'scrollable' | 'never' | 'always' | string;
    preferredContentMode?: 'mobile' | 'desktop' | string;
    backgroundColor?: string;
  };
}

const config: CapacitorConfig = {
  appId: 'com.cheese.uku',
  appName: 'Uku Furigana',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#F2F2F7',
  },
};

export default config;
