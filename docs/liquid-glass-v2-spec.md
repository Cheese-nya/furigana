# Liquid Glass v2 — UI spec for panel ports

Approved by the user on 2026-10-22. The interactive reference is
`docs/mockups/liquid-glass-v2.html` (open it and read its CSS/markup; it is the
source of truth for look and motion). Foundation code is already in the app:

| File | What it gives you |
|---|---|
| `app/globals.css` | Tokens (`--bg --surface --surface-2 --fill --fill-2 --sep --label --label-2 --label-3 --ink --on-ink --ruby --review --ok --danger`), `.glass`, `.gbtn`, `.btn`, `.sel/.seg`, `.scroll-edge`, springs `--spring-bouncy/--spring-smooth` |
| `app/components/glass/GlassButton.tsx` | `<GlassButton variant="item|glass|prominent" icon>` (press physics built in), `<GlassCapsule>` (a glass group of items) |
| `app/components/glass/LiquidSelector.tsx` | `<LiquidSelector options value onChange variant="glass|solid|bare" axis>` — segmented control with the stretch/spring/drag-lens indicator |
| `app/components/glass/GlassPopover.tsx` | `<GlassPopover open onClose anchor|point placement>`, `<PopoverItem icon detail danger>`, `<PopoverSeparator>` |
| `app/components/glass/hooks.ts` | `useGlass()` (refraction ref for custom glass elements — add class `glass`), `usePressPhysics()` |
| `app/components/glass/icons.tsx` | SF-style icons: `IconEdit IconBooks IconRead IconStack IconGear IconMore IconPlus IconClose IconSearch IconStar IconStarFill IconChevronDown/Left/Right IconShare IconImport IconTextFormat IconDictionary IconCheck IconDoc IconLink IconPaste IconTrash IconWarning IconRuby IconSun IconMoon IconGlobe IconHeart IconPulse IconRefresh IconBookmark IconFolder` |

## Rules

1. **Glass only on the floating layer**: toolbars (as `GlassCapsule` groups or a
   `LiquidSelector variant="glass"`), popovers/menus, sheets, the reader capsule.
   **Content is solid**: cards are `bg-[var(--surface)] rounded-[18px]` with
   `shadow-[var(--card-shadow)]`; never put a card inside a card.
2. **Colour**: neutral ink. Text `text-[var(--label)]`, secondary
   `text-[var(--label-2)]`, tertiary `text-[var(--label-3)]`. Primary action =
   ink (`btn btn-ink` in content, `GlassButton variant="prominent"` in toolbars).
   Colour only for state: review `var(--review)` (orange), confirmed `var(--ok)`
   (green), error `var(--danger)` (red). Remove indigo/blue/violet/emerald/amber
   decoration classes and hard-coded hex colours (`#1d1d1f`, `#6e6e73`, `zinc-*`,
   `slate-*` text) in favour of the tokens. Dark mode then works through the
   tokens — do not add `dark:` colour variants for things the tokens cover.
3. **Buttons**: toolbar controls are `GlassButton`; content buttons use `btn`
   (`btn btn-ink`, `btn btn-danger`, `btn btn-plain`). Segmented choices use
   `LiquidSelector` (`variant="glass"` in a toolbar, `"solid"` in content/popovers).
4. **Toolbars float**: `sticky top-[max(10px,env(safe-area-inset-top))] z-20`
   row of glass capsules with `pointer-events-none` on the row and
   `pointer-events-auto` on capsules, so content scrolls underneath. Add a
   `.scroll-edge` strip behind it (fixed height ~70px) if content scrolls under.
5. **Icons**: only from `glass/icons.tsx`; no emoji, no `★ ☆ ☼ ☾`, no inline
   one-off SVG icon components (delete them).
6. **Typography**: UI sans system font; Japanese titles on covers / reader text
   may use `font-family: var(--font-mincho)`. Ruby `rt` colour `var(--ruby)`.
7. **Motion**: press physics come from GlassButton / `.btn`; popovers morph from
   their anchor (GlassPopover does it). Respect `prefers-reduced-motion` (the
   primitives already do).
8. **Keep behaviour**: every prop, handler, state, i18n string and
   `data-testid` that drives behaviour must keep working. Remove only visual
   cruft. Do not touch files you do not own.
9. **States**: loading (skeleton/spinner + label), empty (icon, one-line
   explanation, next action), error (message + retry) must exist where the
   panel has them today.

## Workers must not

- edit `app/globals.css`, `app/page.tsx`, anything in `app/components/glass/`,
  or `tests/` (the leader updates design-lock tests after review);
- run `npm`, `node`, `npx` or a dev server (the leader builds and tests);
- add dependencies.
