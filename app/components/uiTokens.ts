/**
 * Shared Clean / Shadcn UI Utility Style Classes
 */

export const cardClass = "bg-white rounded-xl border border-zinc-200/80 shadow-xs";
export const buttonClass = "bg-white border border-zinc-200 rounded-lg text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 active:bg-zinc-100 shadow-xs transition-colors font-medium";
export const buttonActiveClass = "bg-zinc-900 border border-zinc-900 text-white rounded-lg shadow-xs font-medium transition-colors";
export const inputClass = "bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 placeholder:text-zinc-400 shadow-xs transition-all";
export const badgeClass = "px-2.5 py-0.5 bg-zinc-100 border border-zinc-200/80 rounded-full text-xs font-medium text-zinc-600";

// Backward compatibility aliases
export const neuCard = cardClass;
export const neuButton = buttonClass;
export const neuButtonActive = buttonActiveClass;
export const neuInput = inputClass;
export const neuBadge = badgeClass;
