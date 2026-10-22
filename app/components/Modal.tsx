'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { IconClose } from './glass/icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  /** Sheets that carry their own heading (e.g. the reading-correction sheet) hide the title bar. */
  hideHeader?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  hideHeader = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      // Mount first, then flip `visible` next frame so the entrance transition runs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 560);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
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
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
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
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!mounted) return null;

  const maxWidthClasses = {
    sm: 'max-w-[420px]',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={`fixed inset-0 bg-black/20 transition-opacity duration-[260ms] ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`glass glass-sheet relative flex max-h-[92dvh] w-full ${maxWidthClasses[maxWidth]} flex-col overflow-hidden rounded-[30px] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-[22px] text-[var(--label)] shadow-[var(--glass-shadow)] outline-none transition-[scale,opacity,translate] max-sm:rounded-t-[34px] max-sm:rounded-b-none max-sm:pb-[max(22px,env(safe-area-inset-bottom))] sm:duration-[560ms,200ms,560ms] sm:[transition-timing-function:var(--spring-bouncy),ease,var(--spring-smooth)] max-sm:scale-100 max-sm:opacity-100 max-sm:duration-[560ms] max-sm:[transition-timing-function:var(--spring-smooth)] ${visible ? 'sm:scale-100 sm:opacity-100 max-sm:translate-y-0' : 'sm:scale-90 sm:opacity-0 max-sm:translate-y-full'}`}
      >
        <div className="sm:hidden mx-auto -mt-2.5 mb-3 h-[5px] w-9 shrink-0 rounded-full bg-[var(--label-3)]" aria-hidden="true" />
        {hideHeader ? <h2 id={titleId} className="sr-only">{title}</h2> : (
        <header className="mb-4 flex shrink-0 items-center justify-between gap-4 border-b border-[var(--sep)] pb-3">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-[var(--label)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="btn h-8 w-8 justify-center !p-0" >
            <IconClose size={16} />
          </button>
        </header>
        )}
        <div className="max-h-[calc(92dvh-130px)] overflow-y-auto text-[var(--label-2)]">{children}</div>
        {footer && <footer className="mt-4 flex shrink-0 justify-end gap-3 border-t border-[var(--sep)] pt-4">{footer}</footer>}
      </div>
    </div>
  );
};
