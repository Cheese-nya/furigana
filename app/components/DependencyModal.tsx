'use client';

import React from 'react';
import { Modal } from './Modal';
import type { Translations } from '../utils/i18n';

export interface DependencyItem {
  name: string;
  desc: string;
  status: 'ready' | 'repairing' | 'error' | string;
}

interface DependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  deps: DependencyItem[];
  runDependencyRepair: () => void;
  isKuromojiLoading: boolean;
  t: Translations;
}

export function DependencyModal({
  isOpen,
  onClose,
  deps,
  runDependencyRepair,
  isKuromojiLoading,
  t,
}: DependencyModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.depModalTitle}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t.depModalDesc}
        </p>

        <div className="space-y-2.5">
          {deps.map((dep, idx) => (
            <div key={idx} className="lg-grouped-card p-3.5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{dep.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{dep.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                {dep.status === 'ready' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t.depStatusReady}
                  </span>
                )}
                {dep.status === 'error' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {t.depStatusError}
                  </span>
                )}
                {dep.status === 'repairing' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> {t.depStatusChecking}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 flex justify-between items-center border-t border-slate-200/60 dark:border-white/10">
          <button
            onClick={runDependencyRepair}
            disabled={isKuromojiLoading}
            className="lg-pill-interactive liquid-glass-btn px-4 py-2.5 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-full shadow-xs hover:text-slate-950 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5"
          >
            {isKuromojiLoading && (
              <svg className="w-3.5 h-3.5 animate-spin text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            )}
            {t.depRecheck}
          </button>
          <button
            onClick={onClose}
            className="lg-pill-interactive lg-btn-prominent liquid-glass-btn-primary px-6 py-2.5 min-h-[38px] text-xs font-semibold text-white rounded-full shadow-sm hover:shadow transition-all"
          >
            {t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
