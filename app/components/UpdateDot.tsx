'use client';

/** Yellow "there is an update" dot. Absolute by default, so badge callers need a `relative` parent. */
export function UpdateDot({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--update-dot)] shadow-[0_0_0_1.5px_var(--bg)] ${className}`}
    />
  );
}
