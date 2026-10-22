/**
 * Shared Apple-Inspired iOS 26 Liquid Glass UI Utility Style Classes
 *
 * Glass material primitives live in `app/globals.css`
 * (`.liquid-glass-*` legacy layer + `.lg-*` iOS 26 layer).
 */

// =========================================================
// iOS 26 Liquid Glass primitives (GlassEffectContainer / .glassEffect)
// =========================================================

/** Unified glass container for grouped controls (GlassEffectContainer). */
export const glassContainerClass = "lg-container";
/** Interactive glass element with morph/press physics (.glassEffect().interactive()). */
export const glassPillClass = "lg-container lg-pill-interactive rounded-full";
/** Prominent tinted glass button (.buttonStyle(.glassProminent)). */
export const glassProminentButtonClass = "lg-btn-prominent font-semibold";
/** Adaptive iOS 26 modal/sheet surface (.lg-sheet). */
export const glassSheetClass = "lg-sheet";
/** Inset grouped iOS 26 settings/list card (.lg-grouped-card). */
export const glassGroupedCardClass = "lg-grouped-card rounded-2xl";

// =========================================================
// Cards, panels & inputs
// =========================================================

export const cardClass = "liquid-glass-panel rounded-[24px] sm:rounded-[28px] border border-white/80 dark:border-white/10 transition-[background-color,border-color,box-shadow] duration-200";
export const cardFlatClass = "liquid-glass-panel rounded-[20px] sm:rounded-[24px] border border-white/75 dark:border-white/10 transition-[background-color,border-color,box-shadow] duration-200";

/** Alias of `cardClass` kept for older call sites. */
export const panelClass = cardClass;
/** Alias of `cardFlatClass` kept for older call sites. */
export const subtlePanelClass = cardFlatClass;

export const inputClass = "liquid-glass-inset rounded-2xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400/70 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-[background-color,border-color,box-shadow] duration-150";
export const inputWellClass = inputClass;

// =========================================================
// Buttons & badges
// =========================================================

export const buttonClass = "liquid-glass-btn lg-pill-interactive rounded-full text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-medium shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.92)] dark:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.14)]";
export const buttonPrimaryClass = "liquid-glass-btn-primary lg-btn-prominent rounded-full text-white font-semibold";
export const buttonActiveClass = "liquid-glass-btn-primary lg-btn-prominent rounded-full text-white font-semibold";

export const badgeClass = "px-2.5 py-0.5 rounded-full text-xs font-medium tabular-nums bg-white/75 dark:bg-white/10 border border-white/85 dark:border-white/15 text-slate-600 dark:text-slate-300 shadow-2xs";

// =========================================================
// Liquid Glass Navigation & Segmented Capsule Tokens
// =========================================================

export const glassNavClass = "liquid-glass-nav lg-container rounded-[22px] sm:rounded-[26px] border border-white/80 dark:border-white/10 transition-[background-color,border-color,box-shadow] duration-200";
export const glassPillGroupClass = "liquid-glass-pill-group rounded-full p-1";
export const glassPillActiveClass = "liquid-glass-pill-active rounded-full font-semibold shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.94)] dark:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.18)] lg-pill-interactive";
export const glassPillInactiveClass = "rounded-full lg-pill-interactive text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-white/10";

// Backward compatibility aliases
export const neuCard = cardClass;
export const neuInset = inputWellClass;
export const neuButton = buttonClass;
export const neuPrimaryButton = buttonPrimaryClass;
export const neuButtonActive = buttonActiveClass;
export const neuInput = inputClass;
export const neuBadge = badgeClass;
