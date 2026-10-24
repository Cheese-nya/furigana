'use client';

import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, getPlatform } from '../utils/appInfo';
import type { UpdateState } from '../utils/updateTypes';
import {
  createUpdateController,
  desktopBridgeMissing,
  pickDriver,
  type UpdateController,
} from '../utils/updater';

const INITIAL_UPDATE_STATE: UpdateState = {
  status: 'idle',
  current: APP_VERSION,
  progress: 0,
  manualOnly: true,
  hasUpdate: false,
};

let sharedController: UpdateController | null = null;
let subscriberCount = 0;
let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;

export interface UseUpdaterResult {
  state: UpdateState;
  check: (opts?: { auto?: boolean; force?: boolean }) => Promise<void>;
  startDownload: () => Promise<void>;
  apply: () => Promise<void>;
  dismiss: () => void;
}

export function useUpdater(): UseUpdaterResult {
  const [state, setState] = useState<UpdateState>(INITIAL_UPDATE_STATE);

  useEffect(() => {
    subscriberCount += 1;
    let cancelled = false;
    let unsubscribe = () => {};
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const attach = () => {
      if (cancelled) return;
      if (!sharedController) {
        sharedController = createUpdateController({
          driver: pickDriver(),
          currentVersion: APP_VERSION,
          platform: getPlatform(),
        });
        autoCheckTimer = setTimeout(() => {
          autoCheckTimer = null;
          void sharedController?.check({ auto: true });
        }, 5000);
      }
      unsubscribe = sharedController.subscribe(nextState => {
        setState(nextState);
      });
      setState(sharedController.getState());
    };

    const onReady = () => {
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      attach();
    };
    if (desktopBridgeMissing(window as Parameters<typeof desktopBridgeMissing>[0], getPlatform())) {
      window.addEventListener('pywebviewready', onReady, { once: true });
      // If the event never comes, carry on with the manual driver rather than never checking.
      fallbackTimer = setTimeout(() => {
        window.removeEventListener('pywebviewready', onReady);
        attach();
      }, 8000);
    } else {
      attach();
    }

    return () => {
      cancelled = true;
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
      window.removeEventListener('pywebviewready', onReady);
      unsubscribe();
      subscriberCount -= 1;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        if (autoCheckTimer !== null) {
          clearTimeout(autoCheckTimer);
          autoCheckTimer = null;
        }
        sharedController?.dispose();
        sharedController = null;
      }
    };
  }, []);

  const check = useCallback((opts?: { auto?: boolean; force?: boolean }): Promise<void> => {
    if (!sharedController) return Promise.resolve();
    return sharedController.check(opts);
  }, []);

  const startDownload = useCallback((): Promise<void> => {
    if (!sharedController) return Promise.resolve();
    return sharedController.startDownload();
  }, []);

  const apply = useCallback((): Promise<void> => {
    if (!sharedController) return Promise.resolve();
    return sharedController.apply();
  }, []);

  const dismiss = useCallback((): void => {
    sharedController?.dismiss();
  }, []);

  return {
    state,
    check,
    startDownload,
    apply,
    dismiss,
  };
}
