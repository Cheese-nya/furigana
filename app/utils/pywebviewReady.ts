/**
 * pywebview first exposes an empty `window.pywebview.api` and adds the methods just before it fires
 * `pywebviewready`, so "the api object exists" is not "the api is usable". Wait until `isReady()` holds,
 * or give up after `timeoutMs` and let the caller report that the desktop shell is too old.
 */
export function waitForPywebviewApi(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  isReady: () => boolean,
  timeoutMs = 10000,
): Promise<void> {
  if (isReady()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      target.removeEventListener('pywebviewready', finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    target.addEventListener('pywebviewready', finish, { once: true });
  });
}
