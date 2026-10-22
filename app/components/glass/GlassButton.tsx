'use client';

import React, { forwardRef, useMemo } from 'react';
import { mergeRefs, useGlass, usePressPhysics } from './hooks';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * - `item`: transparent control living inside a glass container (default)
   * - `glass`: a standalone glass capsule (refracts on its own)
   * - `prominent`: tinted ink glass for the primary action
   */
  variant?: 'item' | 'glass' | 'prominent';
  icon?: boolean;
}

/** Glass control with iOS 26 press physics. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = 'item', icon = false, className = '', type = 'button', children, ...rest },
  ref,
) {
  const pressRef = usePressPhysics<HTMLButtonElement>();
  const glassRef = useGlass<HTMLButtonElement>();
  const standalone = variant !== 'item';
  const merged = useMemo(
    () => mergeRefs<HTMLButtonElement>(ref, pressRef, standalone ? glassRef : undefined),
    [ref, pressRef, glassRef, standalone],
  );
  const classes = [
    'gbtn',
    icon ? 'gbtn-icon' : '',
    standalone ? 'glass' : '',
    variant === 'prominent' ? 'gbtn-prominent' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button ref={merged} type={type} className={classes} {...rest}>
      {children}
    </button>
  );
});

/** A glass capsule grouping several GlassButton items (one shared material). */
export function GlassCapsule({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  const glassRef = useGlass<HTMLDivElement>();
  return (
    <div ref={glassRef} className={`glass inline-flex h-[42px] items-center gap-0.5 rounded-full p-[3px] ${className}`} {...rest}>
      {children}
    </div>
  );
}
