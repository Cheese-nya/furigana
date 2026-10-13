'use client';

import React from 'react';
import { Modal } from './Modal';
import { buttonClass } from './uiTokens';
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
        <p className="text-xs text-zinc-500">
          {t.depModalDesc}
        </p>

        <div className="space-y-2.5">
          {deps.map((dep, idx) => (
            <div key={idx} className="p-3 bg-zinc-50/80 border border-zinc-200/80 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium text-xs text-zinc-900">{dep.name}</div>
                <div className="text-[11px] text-zinc-500">{dep.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                {dep.status === 'ready' && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t.depStatusReady}
                  </span>
                )}
                {dep.status === 'error' && <span className="text-xs font-semibold text-red-600">{t.depStatusError}</span>}
                {dep.status === 'repairing' && (
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 animate-pulse">
                    {t.depStatusChecking}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-between items-center">
          <button
            onClick={runDependencyRepair}
            disabled={isKuromojiLoading}
            className={`${buttonClass} px-3.5 py-1.5 text-xs`}
          >
            {t.depRecheck}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-xs"
          >
            {t.done}
          </button>
        </div>
      </div>
    </Modal>
  );
}
