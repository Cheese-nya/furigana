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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content - Clean Shadcn Card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-white rounded-2xl border border-zinc-200 shadow-xl flex flex-col transform transition-all duration-200 outline-none p-6 sm:p-7`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-zinc-100 mb-5">
          <h2 id={titleId} className="text-xl font-semibold text-zinc-900 tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] text-zinc-600">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-5 mt-5 border-t border-zinc-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
