'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { LiquidSelector } from './glass/LiquidSelector';
import type { Translations } from '../utils/i18n';
import type { DiagnosticReport, FeedbackError, FeedbackKind, FeedbackPayload, FeedbackResult } from '../utils/updateTypes';

export interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  initialKind: FeedbackKind;
  /** Injected by the caller (`appLog.buildReport`). */
  buildReport: () => Promise<DiagnosticReport>;
  /** Injected by the caller (`feedback.submitFeedback`). */
  submit: (payload: FeedbackPayload) => Promise<FeedbackResult>;
  buildPayload: (
    input: { kind: FeedbackKind; title?: string; message?: string; contact?: string; includeLog: boolean },
    report?: DiagnosticReport,
  ) => FeedbackPayload;
  /** Opens the created issue after a successful submit. */
  onOpenUrl: (url: string) => void;
  t: Translations;
}

const TITLE_MAX = 80;
const BODY_MAX = 4000;
const NOTE_MAX = 1000;
const PREVIEW_ENTRIES = 8;

/** idle → sending → success | error. */
type FeedbackPhase = 'idle' | 'sending' | 'success' | 'error';

const fieldClass = 'w-full rounded-xl bg-[var(--fill-2)] px-3 text-[16px] text-[var(--label)] placeholder:text-[var(--label-3)] focus:outline-none focus:ring-2 focus:ring-[var(--fill)]';
const inputClass = `${fieldClass} h-[42px]`;
const areaClass = `${fieldClass} min-h-[90px] resize-y py-2.5 leading-relaxed`;
const countClass = 'text-[11px] tabular-nums text-[var(--label-3)]';

function errorText(error: FeedbackError | undefined, t: Translations): string {
  switch (error) {
    case 'rate-limited': return t.feedbackErrRateLimited;
    case 'too-large': return t.feedbackErrTooLarge;
    case 'invalid': return t.feedbackErrInvalid;
    case 'network': return t.feedbackErrNetwork;
    default: return t.feedbackErrServer;
  }
}

/** Feedback sheet shell. `Modal` unmounts the body once the sheet has closed, so every open starts from a clean draft. */
export function FeedbackModal({ open, onClose, initialKind, buildReport, submit, buildPayload, onOpenUrl, t }: FeedbackModalProps) {
  const title = initialKind === 'log' ? t.feedbackTitleLog : t.feedbackTitleText;
  // The body mirrors its send state here so the shell can swallow close presses (backdrop, Escape) mid-request.
  const sendingRef = useRef(false);
  const close = () => { if (!sendingRef.current) onClose(); };
  return (
    <Modal isOpen={open} onClose={close} title={title} maxWidth="lg">
      <FeedbackForm
        buildReport={buildReport} submit={submit} buildPayload={buildPayload} onOpenUrl={onOpenUrl}
        onClose={close} initialKind={initialKind} t={t} sendingRef={sendingRef}
      />
    </Modal>
  );
}

/** Everything below the title bar. */
function FeedbackForm({
  initialKind, onClose, buildReport, submit, buildPayload, onOpenUrl, t, sendingRef,
}: Omit<FeedbackModalProps, 'open'> & { sendingRef: { current: boolean } }) {
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [note, setNote] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [contact, setContact] = useState('');
  const [includeLog, setIncludeLog] = useState(true);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<FeedbackPhase>('idle');
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [reportFailed, setReportFailed] = useState(false);

  useEffect(() => {
    sendingRef.current = phase === 'sending';
    return () => { sendingRef.current = false; };
  }, [phase, sendingRef]);

  // Callers may pass an inline builder; keep the latest one but only fetch on mount.
  const buildReportRef = useRef(buildReport);
  useEffect(() => { buildReportRef.current = buildReport; }, [buildReport]);
  useEffect(() => {
    let alive = true;
    void buildReportRef.current().then(
      value => { if (alive) setReport(value); },
      () => { if (alive) setReportFailed(true); },
    );
    return () => { alive = false; };
  }, []);

  const sending = phase === 'sending';
  const trimmedTitle = issueTitle.trim();
  const trimmedBody = issueBody.trim();
  const formValid = kind === 'log'
    ? true
    : trimmedTitle.length > 0 && trimmedTitle.length <= TITLE_MAX && trimmedBody.length > 0;
  const showPreview = kind === 'log' || includeLog;
  // Never send a log report before the collector finished (or gave up).
  const reportPending = showPreview && !report && !reportFailed;
  const canSend = consent && formValid && !sending && phase !== 'success' && !reportPending;

  const send = async () => {
    if (!canSend) return;
    setPhase('sending');
    setResult(null);
    try {
      const logReport = showPreview ? report : null;
      const payload = buildPayload({
        kind,
        title: kind === 'text' ? trimmedTitle : undefined,
        message: kind === 'text' ? trimmedBody : (note.trim() || undefined),
        contact: contact.trim() || undefined,
        includeLog: logReport !== null,
      }, logReport ?? undefined);
      const value = await submit(payload);
      setResult(value);
      setPhase(value.ok ? 'success' : 'error');
    } catch {
      setResult({ ok: false, error: 'network' });
      setPhase('error');
    }
  };

  const modeSelector = (
    <LiquidSelector
      variant="solid"
      role="radiogroup"
      className="mb-3.5 flex w-full [&>[data-opt]]:h-8 [&>[data-opt]]:flex-1 [&>[data-opt]]:text-[13px]"
      ariaLabel={`${t.feedbackModeLog} / ${t.feedbackModeText}`}
      value={kind}
      onChange={setKind}
      options={[{ value: 'log', label: t.feedbackModeLog }, { value: 'text', label: t.feedbackModeText }]}
    />
  );

  const preview = showPreview && !reportFailed && (
    <details className="rounded-[18px] bg-[var(--fill-2)] p-3">
      <summary className="cursor-pointer select-none text-xs font-semibold text-[var(--label)]">{t.feedbackLogPreview}</summary>
      <div className="mt-2 space-y-2">
        {report ? (
          <>
            <p className="text-[11px] text-[var(--label-2)]">
              {t.feedbackLogEntries.replace('{count}', String(report.entries.length))}
              {' · '}v{report.version}{' · '}{report.device.platform}{' · '}{report.device.screen}{' · '}{report.device.language}
            </p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--surface)] p-2.5 text-[11px] leading-relaxed text-[var(--label-2)]">
              {report.entries.slice(-PREVIEW_ENTRIES).map(entry => (
                `${new Date(entry.t).toLocaleTimeString()} [${entry.level}] ${entry.source}: ${entry.message}`
              )).join('\n') || '—'}
            </pre>
          </>
        ) : (
          <p className="text-[11px] text-[var(--label-2)]">{t.feedbackLogLoading}</p>
        )}
      </div>
    </details>
  );

  const issueUrl = result?.url;
  const footer = phase === 'success' && result?.ok ? (
    <>
      <button type="button" className="btn h-11 flex-1 sm:flex-none" onClick={onClose}>{t.done}</button>
      {issueUrl && (
        <button type="button" className="btn btn-ink h-11 flex-1 sm:flex-none" onClick={() => onOpenUrl(issueUrl)}>{t.feedbackViewIssue}</button>
      )}
    </>
  ) : (
    <>
      <button type="button" className="btn h-11 flex-1 sm:flex-none" disabled={sending} onClick={onClose}>{t.cancel}</button>
      <button type="button" className="btn btn-ink h-11 flex-1 sm:flex-none" disabled={!canSend} onClick={() => void send()}>
        {sending && <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
        {phase === 'error' ? t.feedbackRetry : sending ? t.feedbackSending : t.feedbackSend}
      </button>
    </>
  );

  return (
    <div className="space-y-3.5">
      {modeSelector}

      {kind === 'log' ? (
        <>
          <p className="text-sm leading-relaxed text-[var(--label-2)]">{t.feedbackLogIntro}</p>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--label)]">
            <span className="flex items-baseline justify-between gap-2">
              {t.feedbackNoteLabel}
              <span className={countClass}>{note.length}/{NOTE_MAX}</span>
            </span>
            <textarea className={areaClass} value={note} maxLength={NOTE_MAX} onChange={event => setNote(event.target.value)} />
          </label>
        </>
      ) : (
        <>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--label)]">
            <span className="flex items-baseline justify-between gap-2">
              {t.feedbackIssueTitleLabel}
              <span className={countClass}>{issueTitle.length}/{TITLE_MAX}</span>
            </span>
            <input className={inputClass} value={issueTitle} maxLength={TITLE_MAX} onChange={event => setIssueTitle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-[var(--label)]">
            <span className="flex items-baseline justify-between gap-2">
              {t.feedbackIssueBodyLabel}
              <span className={countClass}>{issueBody.length}/{BODY_MAX}</span>
            </span>
            <textarea className={areaClass} value={issueBody} maxLength={BODY_MAX} onChange={event => setIssueBody(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--label)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={includeLog} onChange={event => setIncludeLog(event.target.checked)} />
            {t.feedbackAttachLog}
          </label>
        </>
      )}

      <label className="grid gap-1.5 text-xs font-medium text-[var(--label)]">
        {t.feedbackContactLabel}
        <input className={inputClass} value={contact} maxLength={80} onChange={event => setContact(event.target.value)} />
      </label>

      {preview}

      <p className="rounded-xl bg-[color-mix(in_srgb,var(--review)_12%,transparent)] p-3 text-xs leading-relaxed text-[var(--label-2)]">{t.feedbackPrivacy}</p>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-[var(--label)]">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" checked={consent} onChange={event => setConsent(event.target.checked)} />
        <span>{t.feedbackConsent}</span>
      </label>

      {phase === 'success' && result?.ok && (
        <p role="status" className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] p-3 text-xs font-medium text-[var(--ok)]">
          {t.feedbackSuccess.replace('{number}', String(result.number ?? ''))}
        </p>
      )}
      {phase === 'error' && (
        <p role="alert" className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] p-3 text-xs font-medium text-[var(--danger)]">
          {errorText(result?.error, t)}
        </p>
      )}

      <div className="flex gap-2 border-t border-[var(--sep)] pt-3 sm:justify-end">{footer}</div>
    </div>
  );
}
