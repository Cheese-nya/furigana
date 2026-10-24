import {
  RELAY_BASE,
  type DiagnosticReport,
  type FeedbackError,
  type FeedbackKind,
  type FeedbackPayload,
  type FeedbackResult,
} from './updateTypes';

export const FEEDBACK_LAST_KEY = 'uku.feedback.last';
export const FEEDBACK_CLIENT_ID_KEY = 'uku.feedback.clientId';
export const MAX_FEEDBACK_BYTES = 60 * 1024;
export const FEEDBACK_COOLDOWN_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;

function utf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).byteLength;
  }
  return str.length;
}

function getDefaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {}
  try {
    if (typeof window !== 'undefined' && (window as unknown as { localStorage?: Storage }).localStorage) {
      return (window as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {}
  return undefined;
}

export function validateFeedback(p: FeedbackPayload): FeedbackError | null {
  if (!p || typeof p !== 'object') return 'invalid';
  if (p.kind !== 'log' && p.kind !== 'text') return 'invalid';
  if (typeof p.includeLog !== 'boolean') return 'invalid';

  if (p.kind === 'text') {
    if (typeof p.title !== 'string') return 'invalid';
    const trimmed = p.title.trim();
    if (trimmed.length < 1 || p.title.length > 80) return 'invalid';
  } else if (p.title !== undefined) {
    if (typeof p.title !== 'string' || p.title.length > 80) return 'invalid';
  }

  if (p.message !== undefined) {
    if (typeof p.message !== 'string' || p.message.length > 4000) return 'invalid';
  }

  if (p.contact !== undefined) {
    if (typeof p.contact !== 'string' || p.contact.length > 80) return 'invalid';
  }

  if (p.includeLog) {
    if (!p.log || typeof p.log !== 'object' || !Array.isArray(p.log.entries)) {
      return 'invalid';
    }
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(p);
  } catch {
    return 'invalid';
  }

  if (utf8ByteLength(serialized) > MAX_FEEDBACK_BYTES) {
    return 'too-large';
  }

  return null;
}

export interface FeedbackInput {
  kind: FeedbackKind;
  title?: string;
  message?: string;
  contact?: string;
  includeLog: boolean;
}

export function buildFeedbackPayload(input: FeedbackInput, report?: DiagnosticReport): FeedbackPayload {
  const payload: FeedbackPayload = {
    kind: input.kind,
    includeLog: Boolean(input.includeLog),
  };

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length > 0) {
    payload.title = title;
  }

  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message.length > 0) {
    payload.message = message;
  }

  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';
  if (contact.length > 0) {
    payload.contact = contact;
  }

  if (payload.includeLog && report) {
    const entries = Array.isArray(report.entries) ? report.entries.map(e => ({ ...e })) : [];
    payload.log = {
      ...report,
      entries,
    };

    while (
      payload.log.entries.length > 0 &&
      utf8ByteLength(JSON.stringify(payload)) > MAX_FEEDBACK_BYTES
    ) {
      payload.log.entries.shift();
    }
  }

  return payload;
}

/** Random per-install id the relay rate-limits on (it cannot see client IPs). Falls back to a fresh id per call without storage. */
export function getClientId(storage?: Pick<Storage, 'getItem' | 'setItem'>): string {
  try {
    const saved = storage?.getItem(FEEDBACK_CLIENT_ID_KEY);
    if (saved && /^[A-Za-z0-9-]{16,64}$/.test(saved)) return saved;
  } catch {
    // fall through and mint a new id
  }
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  try {
    storage?.setItem(FEEDBACK_CLIENT_ID_KEY, id);
  } catch {
    // an unsaved id only weakens per-install limiting
  }
  return id;
}

export interface SubmitFeedbackDeps {
  fetch?: typeof fetch;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  timeoutMs?: number;
}

export async function submitFeedback(
  payload: FeedbackPayload,
  deps?: SubmitFeedbackDeps,
): Promise<FeedbackResult> {
  const validationError = validateFeedback(payload);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const nowFn = deps?.now ?? Date.now;
  const storage = deps && 'storage' in deps ? deps.storage : getDefaultStorage();
  const currentTime = nowFn();

  try {
    const rawLast = storage?.getItem(FEEDBACK_LAST_KEY);
    if (rawLast !== null && rawLast !== undefined && rawLast !== '') {
      const lastTime = Number(rawLast);
      if (Number.isFinite(lastTime) && currentTime - lastTime >= 0 && currentTime - lastTime < FEEDBACK_COOLDOWN_MS) {
        return { ok: false, error: 'rate-limited' };
      }
    }
  } catch {
    // Ignore storage read failure
  }

  const fetchFn = deps?.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (typeof fetchFn !== 'function') {
    return { ok: false, error: 'network' };
  }

  const timeoutMs = deps?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
        reject(new Error('Request timed out'));
      }, timeoutMs);
      if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
        (timer as { unref?: () => void }).unref?.();
      }
    });

    const response = await Promise.race([
      fetchFn(`${RELAY_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, clientId: payload.clientId ?? getClientId(storage) }),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);

    if (response.status === 429) {
      return { ok: false, error: 'rate-limited' };
    }
    if (response.status === 413) {
      return { ok: false, error: 'too-large' };
    }
    if (response.status === 400) {
      return { ok: false, error: 'invalid' };
    }
    if (response.status >= 500) {
      return { ok: false, error: 'server' };
    }
    if (!response.ok) {
      return { ok: false, error: 'server' };
    }

    const data = (await response.json()) as { ok?: boolean; number?: number; url?: string; error?: FeedbackError };
    if (data && data.ok === false) {
      return { ok: false, error: data.error || 'server' };
    }

    try {
      storage?.setItem(FEEDBACK_LAST_KEY, String(nowFn()));
    } catch {
      // Ignore storage write failure
    }

    return {
      ok: true,
      number: typeof data?.number === 'number' ? data.number : undefined,
      url: typeof data?.url === 'string' ? data.url : undefined,
    };
  } catch {
    return { ok: false, error: 'network' };
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
