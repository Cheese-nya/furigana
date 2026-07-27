'use client';

import React, { useEffect, useRef } from 'react';

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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

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
      aria-labelledby="modal-title"
    >
      {/* Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-gray-600/30 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content - Neumorphic Convex Card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-[#e0e5ec] rounded-2xl shadow-[12px_12px_24px_#b8bcc2,-12px_-12px_24px_#ffffff] flex flex-col transform transition-all duration-200 outline-none p-6 md:p-8`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-6">
          <h2 id="modal-title" className="text-2xl font-semibold text-gray-800">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="w-9 h-9 rounded-xl bg-[#e0e5ec] shadow-[4px_4px_8px_#b8bcc2,-4px_-4px_8px_#ffffff] hover:shadow-[2px_2px_4px_#b8bcc2,-2px_-2px_4px_#ffffff] active:shadow-[inset_2px_2px_4px_#b8bcc2,inset_-2px_-2px_4px_#ffffff] flex items-center justify-center text-gray-600 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(100vh-200px)] text-gray-600">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="pt-6 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
