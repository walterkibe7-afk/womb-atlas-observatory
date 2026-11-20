# Steward Portal — Design System Handover

Covers the UI work done for the Atlas Steward Portal redesign: the theming
architecture, the reusable primitives in `src/components/ui/`, and the rules to
follow when building the participant and admin portals on top of them.

**The one rule:** never write a hex value inside a component. Style against the
semantic tokens. If you need a colour that doesn't exist, add a token — don't
inline it.

---

## 1. Theming architecture

Everything lives in `src/app/globals.css`. There are two layers.

### Layer 1 — semantic tokens (`@theme`)

These name a *role*, not a colour: `--color-surface`, `--color-fg`,
`--color-border`, `--color-danger`. Every component — including the shared
primitives — styles itself against these and nothing else.

Because they're declared in Tailwind v4's `@theme` block, each one generates
utilities automatically:

| Token | Utilities it generates |
| --- | --- |
| `--color-brand-gold` | `text-brand-gold`, `bg-brand-gold`, `border-brand-gold` |
| `--color-fg` | `text-fg`, `bg-fg`, … |
| `--radius-card` | `rounded-[var(--radius-card)]` |

Tailwind v4 compiles `text-brand-gold` to `color: var(--color-brand-gold)` — it
emits the *variable reference*, not the resolved value. That indirection is what
makes layer 2 work.

### Layer 2 — portal palettes + `.theme-*` scopes

Each portal owns a block of raw brand colours, namespaced by portal:

```css
--color-steward-page: #0a050a;        /* page background */
--color-steward-card: #140d11;        /* card background */
--color-steward-primary: #a56e33;     /* bronze — headings, icons, accents */
--color-steward-secondary: #fffed3;   /* cream — body text, numerals */
--color-steward-accent: #c06ad0;      /* magenta — markers, NEW badges */
--color-steward-high / -medium / -low / -info
```

A `.theme-steward` class then re-points the semantic tokens at that palette:

```css
.theme-steward {
  --color-background: var(--color-steward-page);
  --color-surface:    var(--color-steward-card);
  --color-brand-gold: var(--color-steward-primary);
  --color-fg:         var(--color-steward-secondary);
  /* …plus the text ramp, gradients, severity colours */
}
```

The class is applied on the route-group root in `src/app/(steward)/layout.tsx`.
Everything beneath it inherits the steward colours; the participant and admin
portals keep the `@theme` defaults untouched.

**To theme another portal:** add a `--color-<portal>-*` palette, add a
`.theme-<portal>` block that maps the semantic tokens onto it, and put the class
on that route group's `layout.tsx`. Zero component changes.

### The full semantic token set

```
Surfaces      --color-background  --color-surface  --color-surface-hover
              --color-surface-inset
Borders       --color-border  --color-border-subtle  --color-border-strong
              --color-border-active   (selected nav / queue row)
              --color-border-brand    (gold rings: logo, footer marks)
Brand         --color-brand-gold  --color-brand-purple  --color-brand-purple-light
              --color-brand-purple-dark  --color-brand-orange  --color-brand-green
              --color-brand-blue  --color-danger  --color-link
Accent fills  --color-accent-soft    (Badge bg)
              --color-accent-strong  (primary CTA icon tile)
              --color-cta-border
On-colours    --color-on-gold    (text on a gold button)
              --color-on-accent  (text on accent-strong)
              --color-on-avatar  (monogram on the avatar gradient)
Chrome        --color-logo  --color-logo-sub  --color-grid
Charts        --color-chart-1  --color-chart-2  --color-chart-3
Text ramp     --color-fg → --color-muted → --color-subtle → --color-faint
              (aliases --color-text-primary / --color-text-secondary kept for
               older var() call sites)
Radii         --radius-card (14px)  --radius-panel (10px)
Type          --font-sans (Instrument Sans)  --font-serif (Spectral)  --font-mono
```

Two naming notes. The short text aliases exist because `--color-text-secondary`
would generate the utility `text-text-secondary`; `--color-muted` gives you
`text-muted`. And the "on-colours" exist so that a component can put text on a
coloured fill without knowing what that fill is — `bg-brand-gold text-on-gold`
stays legible in every theme.

### Gradients

Gradients can't be `@theme` colours, so they're `:root` custom properties with
helper classes, and they're overridden inside `.theme-steward` like everything
else:

| Class | Variable | Used by |
| --- | --- | --- |
| `.bg-page-radial` | `--gradient-page` | route-group `<main>` |
| `.bg-surface-card` | `--gradient-surface` | `Card` (default) |
| `.bg-surface-plum` | `--gradient-surface-plum` | `Card variant="plum"` |
| `.bg-nav-active` | `--gradient-nav-active` | active sidebar row, selected queue row |
| `.bg-avatar` | `--gradient-avatar` | `Avatar` |
| `.bg-cta` | `--gradient-cta` | primary action tile |
| `.bg-logo` | `--gradient-logo` | sidebar wordmark disc |

### Typography

`src/app/layout.tsx` loads **Spectral** (serif) and **Instrument Sans** (sans)
via `next/font/google`, exposing `--font-spectral` / `--font-instrument` on
`<body>`; `@theme` maps them to `--font-serif` / `--font-sans`.

Convention: **serif for headings and numerals, sans for everything else.** Stat
values, donut percentages, and section titles are `font-serif`. Section titles
are additionally uppercase, `tracking-[0.08em]`, and `text-brand-gold`.

---

## 2. Reusable primitives — `src/components/ui/`

Import from the barrel: `import { Card, Button, Badge } from "@/components/ui";`

These are portal-agnostic. They contain no hex values and no steward-specific
logic, so they'll render in participant/admin colours the moment those portals
get a `.theme-*` class.

| Component | Props | Notes |
| --- | --- | --- |
| **`Card`** | `variant: "surface" \| "plum" \| "inset"`, `padding = true`, `className` | The base surface: gradient fill, hairline border, `--radius-card`. Pass `padding={false}` when children manage their own spacing — otherwise the built-in `p-4` fights any `p-*` you add via `className`. |
| **`SectionCard`** | `title`, `isNew?`, `action?`, `className`, `bodyClassName` | `Card` + the standard header (uppercase gold Spectral title, optional NEW badge, right-aligned action slot). `bodyClassName` targets the content wrapper — that's how the dashboard gives two sections a shared height with internal scroll. |
| **`SectionLink`** | `href = "#"` | The recurring `view all →` link (`text-link`, underline on hover). |
| **`Button`** | `variant: "primary" \| "secondary" \| "ghost" \| "danger"`, `size: "sm" \| "md"`, `loading`, `icon` | `loading` swaps the leading icon for a spinner **and** disables the button. `primary` is the solid gold CTA. |
| **`Badge`** | `variant: "new" \| "accent" \| "neutral" \| "outline" \| "gold"` | Small label chip. `new` is the tiny magenta NEW pill. |
| **`SeverityTag`** | `level: string`, `showLabel = true` | Coloured dot + label. Shares one vocabulary with `Badge`: High → danger, Medium → amber, Low → green. |
| **`normalizeSeverity`** | `(level: string) => "High" \| "Medium" \| "Low"` | Maps API casing/synonyms (`"moderate"` → `"Medium"`). Use this rather than comparing raw strings. |
| **`MetricCard`** | `icon`, `label`, `value`, `sub?`, `trend?`, `iconColorClass?`, `variant?` | Dashboard stat tile: large outlined icon on the left, label + Spectral numeral + sub stacked beside it. `trend` takes `{ direction, label, colorClass? }`. |
| **`Tabs`** | `tabs: TabItem[]`, `active`, `onChange` | Controlled underlined tab bar; gold underline on active. `TabItem = { id, label, isNew? }`. |
| **`Sparkline`** | `data: number[]`, `color?`, `width?`, `height?` | Dependency-free inline SVG polyline. Deliberately **not** recharts — it renders once per list row, so it needs to be cheap. |
| **`Donut`** | `percent`, `size?`, `thickness?`, `color?`, `track?`, `centerBg?`, `children` | Conic-gradient ring with a punched-out centre. Centre content is free-form (usually the percentage in Spectral). |
| **`IconTile`** | `size?`, `colorClass?` | Rounded-square icon container. |
| **`Avatar`** | `initials`, `size = 34` | Gradient monogram. |

`src/lib/cn.ts` is a dependency-free class-name joiner (`cn(...classes)`) used
by all of the above. It is *not* `tailwind-merge` — later classes don't override
earlier ones, they just concatenate. When a caller needs to override a
primitive's built-in utility, the primitive exposes a prop for it (that's why
`Card` has `padding`).

---

## 3. Steward-specific components

Not reusable across portals, but they show the intended composition style.

- **`src/components/StewardSidebar.tsx`** — nav driven by a `NAV_GROUPS` array.
  Entries **with** an `href` render as `<Link>` with active state; entries
  **without** render as non-clickable "coming soon" placeholders, so an unbuilt
  screen never 404s. Sign-out calls `logout()` from `@/lib/logout`, **not**
  `signOut({ callbackUrl })` — NextAuth resolves `callbackUrl` against
  `AUTH_URL`, which pins the redirect to localhost in deployed environments.

- **`src/components/steward/ReviewQueue.tsx`** — accepts `className` (the card)
  and `listClassName` (the scroll container) so callers control height. It does
  **not** hardcode a grid span.

- **`src/components/steward/RecordDetail.tsx`** — tabbed record view built on
  `Tabs`. Mounted with `key={record.id}` by callers so switching records
  remounts rather than needing a reset effect.

- **`src/components/steward/dashboard/StaticSections.tsx`** — the design's
  presentational panels (`GrowthDashboard`, `ObservationReturnRate`,
  `AlertsAndQuickActions`, `MeaningSignals`, `ReviewerActionsRow`,
  `PortalFooter`). **These render fixed sample values** pending a second
  iteration. `DataQualityCard` is the exception — it's already wired to live
  data (see §5).

---

## 4. Layout patterns

The dashboard (`src/app/(steward)/steward/page.tsx`) is a three-column flex
masonry. Real content is taller and less predictable than the mockup's sample
data, so **paired panels are locked to a shared height and scroll internally**
rather than being allowed to size to their content — otherwise one long record
summary leaves dead space beside its neighbours.

```tsx
const PANEL_HEIGHT   = "h-[560px]";                 // queue ↔ record detail
const SECTION_HEIGHT = "h-[420px] flex flex-col";   // growth ↔ return rate
const SECTION_BODY   = "flex-1 min-h-0 overflow-y-auto";
```

`min-h-0` is load-bearing: without it a flex child refuses to shrink below its
content's intrinsic height, and the card grows past the height you set.

Scrollbars are themed globally in `globals.css` (thin, gold, transparent
track). Add `[&::-webkit-scrollbar]:hidden` to hide one locally.

---

## 5. What's dynamic vs. static

| Section | State |
| --- | --- |
| Stat cards, Review Queue, Record Detail, Signal Snapshot, Emerging Concepts | **Live** (`/api/steward/stats`, `/api/steward/records`) |
| `DataQualityCard` | **Live** — `approved / (approved + rejected)`. Flagged records are excluded from the denominator: a flag is an open question, not a decision. Badge tiers at ≥90% gold, ≥70% amber, else red; a zero denominator shows `—` / "No decisions yet". |
| Growth Dashboard, Observation Return Rate, Recent Alerts, Quick Actions, Meaning Signals, Reviewer Actions | **Static sample data**, to be wired in the next iteration |

Note the Reviewer Actions row at the bottom is presentational **by design**. The
functional Approve / Flag / Reject controls live inside `RecordDetail` so a
record's status can never be changed by a control that isn't bound to it.

---

## 6. Known gaps

- `src/app/(steward)/steward/audit/page.tsx` predates the redesign and still
  hardcodes the old purple hex (`#1A1325`, `#3A2B4A`). It will look wrong beside
  the retheme.
- `src/components/AdminSidebar.tsx`, `Sidebar.tsx`, `CreateUserModal.tsx`,
  `EditRoleDropdown.tsx`, and `participant/SignalEvolutionChart.tsx` also
  hardcode colours — they're the next candidates for the token migration.
- The severity, accent, and border shades in the steward palette were matched by
  eye from the design export, not lifted from Figma. If exact values surface,
  they're a one-line change in the palette block.
- `ObservationsTab.tsx` is no longer referenced (the tab was removed from the
  record detail) and can be deleted along with the `observations` field in the
  detail payload.
