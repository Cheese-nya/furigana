'use client';

import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, getPlatform } from '../utils/appInfo';
import type { UpdateState } from '../utils/updateTypes';
import {
  createUpdateController,
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

    const unsubscribe = sharedController.subscribe(nextState => {
      setState(nextState);
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(sharedController.getState());

    return () => {
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
