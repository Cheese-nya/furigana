'use client';

import React from 'react';
import { Modal } from './Modal';
import { IconCheck, IconWarning } from './glass/icons';
import type { Translations } from '../utils/i18n';

export interface DependencyItem { name: string; desc: string; status: 'ready' | 'repairing' | 'error' | string; }
interface DependencyModalProps { isOpen: boolean; onClose: () => void; deps: DependencyItem[]; runDependencyRepair: () => void; isKuromojiLoading: boolean; t: Translations; }

export function DependencyModal({ isOpen, onClose, deps, runDependencyRepair, isKuromojiLoading, t }: DependencyModalProps) {
  return <Modal isOpen={isOpen} onClose={onClose} title={t.depModalTitle}>
    <div className="space-y-4"><p className="text-xs leading-relaxed text-[var(--label-2)]">{t.depModalDesc}</p>
      <ul className="overflow-hidden rounded-[18px] bg-[var(--surface)] shadow-[var(--card-shadow)]">{deps.map(dep => {
        const ready = dep.status === 'ready';
        const error = dep.status === 'error';
        const statusLabel = ready ? t.depStatusReady : error ? t.depStatusError : t.depStatusChecking;
        const statusColor = ready ? 'text-[var(--ok)]' : error ? 'text-[var(--danger)]' : 'text-[var(--label-2)]';
        return <li key={dep.name} className="flex items-center justify-between gap-3 border-b border-[var(--sep)] px-4 py-3 last:border-b-0"><div><p className="text-xs font-semibold text-[var(--label)]">{dep.name}</p><p className="mt-0.5 text-[11px] text-[var(--label-2)]">{dep.desc}</p></div><span className={`inline-flex items-center gap-1 text-xs font-semibold ${statusColor}`}>{ready ? <IconCheck size={14} /> : error ? <IconWarning size={14} /> : <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}{statusLabel}</span></li>;
      })}</ul>
      <div className="flex justify-between border-t border-[var(--sep)] pt-4"><button type="button" onClick={runDependencyRepair} disabled={isKuromojiLoading} className="btn h-11 disabled:opacity-40">{t.depRecheck}</button><button type="button" onClick={onClose} className="btn btn-ink h-11">{t.done}</button></div>
    </div>
  </Modal>;
}
