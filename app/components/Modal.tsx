'use client';

import React, { useEffect, useId, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md'
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => {
      if (!modalRef.current?.contains(document.activeElement)) modalRef.current?.focus();
    }, 0);
    const handleKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
      )).filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        modalRef.current.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modalRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/35 dark:bg-black/60 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content - iOS 26 Adaptive Liquid Glass Sheet & Mobile Bottom Sheet */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClasses[maxWidth]} max-h-[92dvh] lg-sheet backdrop-blur-2xl bg-white/88 dark:bg-[#161a29]/95 border border-white/80 dark:border-white/12 max-sm:rounded-t-[32px] max-sm:rounded-b-none sm:rounded-[32px] shadow-[0_24px_64px_-12px_rgba(15,23,42,0.18),inset_0_1px_0.5px_rgba(255,255,255,0.96)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75),inset_0_1px_0.5px_rgba(255,255,255,0.16)] flex flex-col transform transition-[transform,opacity,background-color] duration-200 outline-none p-5 sm:p-7 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
      >
        {/* iOS Bottom Sheet Grabber Pill (Mobile Only) */}
        <div
          className="sm:hidden mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-400/40 dark:bg-white/25"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-4 border-b border-slate-200/60 dark:border-white/10 mb-4 sm:mb-5 shrink-0">
          <h2 id={titleId} className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-full lg-pill-interactive text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-black/[0.04] dark:bg-white/[0.06] hover:bg-white/75 dark:hover:bg-white/12 border border-white/70 dark:border-white/10 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(92dvh-130px)] text-slate-600 dark:text-slate-300">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-4 mt-4 sm:mt-5 border-t border-slate-200/60 dark:border-white/10 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
