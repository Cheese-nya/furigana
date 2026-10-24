/**
 * What the Android back key should do inside the app. Overlays (modals, popovers) register while they are
 * open and are closed newest-first; once none are left the page-level handler steps back one screen
 * (reader -> library -> workbench). `handleBack()` returns false only when there is nothing left to go back
 * to, which is when the native shell lets the app exit.
 */
type BackHandler = () => void;

const overlays: BackHandler[] = [];
let navigateBack: (() => boolean) | null = null;

export function registerBackHandler(handler: BackHandler): () => void {
  overlays.push(handler);
  return () => {
    const index = overlays.lastIndexOf(handler);
    if (index >= 0) overlays.splice(index, 1);
  };
}

/** The page's own "go up one screen"; returns whether it did anything. */
export function setNavigationBack(handler: (() => boolean) | null): void {
  navigateBack = handler;
}

export function handleBack(): boolean {
  const top = overlays[overlays.length - 1];
  if (top) {
    top();
    return true;
  }
  return navigateBack ? navigateBack() : false;
}

/** Expose `handleBack` to the Android shell, which calls `window.__ukuBack()` from `onBackPressed`. */
export function installBackBridge(target: { __ukuBack?: () => boolean }): () => void {
  target.__ukuBack = handleBack;
  return () => {
    if (target.__ukuBack === handleBack) delete target.__ukuBack;
  };
}
