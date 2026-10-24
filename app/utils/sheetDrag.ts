/**
 * Drag-to-dismiss maths for bottom sheets (phone width). Kept free of the DOM so it can be tested:
 * the sheet follows the finger down 1:1, resists being pulled up, and on release closes when it was
 * dragged far enough or flicked fast enough; otherwise it springs back.
 */

/** How far the sheet is drawn for a raw finger movement `dy` (px, positive = down). */
export function dragOffset(dy: number): number {
  if (!Number.isFinite(dy)) return 0;
  if (dy >= 0) return dy;
  // pulling up meets resistance and never goes far (rubber band)
  return -Math.min(28, Math.sqrt(-dy) * 3.2);
}

export interface ReleaseState {
  /** Offset the sheet was released at (px, positive = down). */
  offset: number;
  /** Release velocity in px/ms, positive = down. */
  velocity: number;
  /** Height of the sheet (px). */
  height: number;
}

export const FLICK_VELOCITY = 0.55;
export const MIN_FLICK_DISTANCE = 28;

export function shouldDismiss({ offset, velocity, height }: ReleaseState): boolean {
  if (!(offset > 0)) return false;
  if (velocity >= FLICK_VELOCITY && offset >= MIN_FLICK_DISTANCE) return true;
  // dragged past a quarter of the sheet, but never demand more than 160px of travel
  return offset >= Math.min(160, Math.max(80, height * 0.25));
}

/** 0 (fully shown) … 1 (gone): drives the backdrop fade while dragging. */
export function dragProgress(offset: number, height: number): number {
  if (!(height > 0) || !(offset > 0)) return 0;
  return Math.min(1, offset / height);
}
