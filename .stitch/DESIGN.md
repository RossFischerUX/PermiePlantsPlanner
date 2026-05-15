# Design System: Botanical Heritage
**Project ID:** 7515704749920381908
**Stitch Project:** Permaculture Plant Picker — Redesign

---

## 1. Visual Theme & Atmosphere

**"Sophisticated Naturalist"** — a blend of high-end editorial publishing and archival botanical records. Evokes the feeling of browsing a premium physical field guide or a curated greenhouse library.

The style is **Minimalist-Editorial**: generous whitespace, a warm "analog" color palette, and high-contrast typographic hierarchy. Visuals feel grounded and organic — soft textures, subtle warm shadows, layouts that prioritize high-quality botanical photography. The goal is a serene, studious environment that feels timeless and authoritative.

---

## 2. Color Palette & Roles

| Name | Hex | Role |
|------|-----|------|
| Warm Parchment | `#f5f0e8` | Page canvas / app background |
| Aged Cream | `#fdfaf4` | Card and panel surfaces |
| Stone White | `#f0ebe0` | Filter sidebar background |
| Deep Forest | `#2d5016` | Primary buttons, active states, links, nav accents |
| Forest Dark | `#173901` | Primary color (darkest green, high emphasis) |
| Terracotta | `#c4622d` | Active filter pills, badges, hover highlights, add buttons |
| Warm Stone | `#8c7b6b` | Secondary text, borders, dividers (use at 30% opacity for borders) |
| Dark Bark | `#1c1207` | Primary text, headings |
| Warm Umber | `#5c4a35` | Secondary text, latin names, metadata, captions |
| Sage Mist | `#a8d38a` | Inverse primary / light accent |

### Extended Surface Scale
| Token | Hex | Use |
|-------|-----|-----|
| `surface` | `#fef9f1` | Default surface |
| `surface-container-low` | `#f8f3eb` | Slightly elevated container |
| `surface-container` | `#f2ede5` | Mid container |
| `surface-container-high` | `#ece8e0` | Higher container |
| `surface-dim` | `#ded9d2` | Dimmed / disabled surface |
| `outline` | `#73796c` | Default border color |
| `outline-variant` | `#c3c9b9` | Subtle border |

### Badge Colors
- **Sun badges:** Amber/golden background with sun icon
- **Water badges:** Blue-green background with water drop icon
- **Active filter pills:** Terracotta (`#c4622d`) background, white text

---

## 3. Typography Rules

### Font Families
- **Playfair Display** (serif) — editorial, expressive roles
- **Inter** (sans-serif) — all functional UI, body copy, data

### Type Scale
| Token | Family | Size | Weight | Line Height | Use |
|-------|--------|------|--------|-------------|-----|
| `display-lg` | Playfair Display | 48px | 700 | 1.1 (–0.02em tracking) | Page heroes |
| `display-lg-mobile` | Playfair Display | 32px | 700 | 1.2 | Mobile heroes |
| `headline-lg` | Playfair Display | 32px | 600 | 1.2 | Page titles ("Plant Database") |
| `headline-md` | Playfair Display | 24px | 600 | 1.3 | Section headings, card plant names |
| `headline-sm` | Playfair Display | 20px | 500 | 1.4 | Sub-section headings |
| `body-lg` | Inter | 18px | 400 | 1.6 | Primary body copy |
| `body-md` | Inter | 16px | 400 | 1.5 | Standard body, descriptions |
| `label-md` | Inter | 14px | 500 | 1.2 (0.02em tracking) | Filter labels, UI labels |
| `label-sm` | Inter | 12px | 600 | 1.2 (0.05em tracking) | Badges, tags, uppercase categories |

### Typography Rules
- **Playfair Display** for: page titles, plant common names, section headings, display pull-quotes
- **Inter** for: navigation, filter labels, buttons, badges, body descriptions, metadata
- Use `label-sm` in UPPERCASE with wide tracking for category tags (e.g., "PERENNIAL", "ZONE 4")
- Latin/botanical names: Inter italic, Warm Umber color

---

## 4. Component Stylings

### Buttons
- **Primary:** Deep Forest (`#2d5016`) fill, white text, 8px radius, Inter `label-md`
- **Secondary:** Warm Stone outline, transparent fill, 8px radius
- **Ghost:** Transparent with border, reveals on hover — used for "Add to List" on cards
- **Terracotta outline:** Used for "Load more" / secondary CTAs on mobile

### Cards (Botanical Cards)
- Background: Aged Cream (`#fdfaf4`)
- Border radius: 16px
- Border: 1px Warm Stone (`#8c7b6b`) at 30% opacity
- Shadow: Soft, diffused warm shadow — `rgba(61, 43, 31, 0.10)` with 15–20px blur, minimal offset
- Padding: minimum 16px
- Image: Full-width at top, 16px radius on top corners only; hero element
- Desktop: Vertical card, 3-column grid
- Mobile: Vertical card, full-width single column

### Filter Sidebar
- Background: Stone White (`#f0ebe0`)
- Width: 280–320px fixed on desktop
- Section headers: Inter Semi-bold, uppercase, `label-sm`
- Filter options: Checkboxes with `accent-color: #2d5016`
- Chevron toggles for collapsible sections
- Active filter pills: Terracotta background, shown at top of sidebar
- No "Apply Filters" button — filters apply on click automatically

### Badges / Tags
- Border radius: pill / full (9999px)
- Sun: Amber/gold background, sun icon, fixed min-width, no text wrap
- Water: Blue-green background, water drop icon, fixed min-width, no text wrap
- Category: Terracotta at 10% opacity background, Terracotta 100% text

### Input Fields
- Border: 1px Warm Stone, or bottom-border only style
- Background: Slightly darker than surface (Stone White)
- Border radius: 8px (or pill for search)
- Focus: Deep Forest accent border ring

### Navigation Bar
- Background: Warm Parchment (`#f5f0e8`)
- Bottom border: Warm Stone at 30% opacity
- Logo: Playfair Display
- Sticky positioning

### Pagination
- Minimal prev/next arrows + page numbers
- Active page: Deep Forest (`#2d5016`)
- Inactive: Warm Stone
- Plant count label: left-aligned above grid, Inter `label-md`

---

## 5. Layout Principles

### Desktop
- Max container width: 1440px
- 12-column grid, 24px gutters
- Page header (title + subtitle + search) spans full content width above the two-column layout
- Two-column layout: 280–320px filter sidebar left, card grid right — both starting at the same top edge
- Generous vertical spacing: 32px+ between sections
- Horizontal page padding: 64px

### Mobile
- 4-column fluid grid, 20px container margin, 16px gutters
- Single-column card list
- Filter sidebar becomes bottom sheet drawer
- Search bar: full-width pill below nav
- Horizontal filter chips: scrollable row
- Pagination: 10 items/page with prev/next controls

### Spacing Scale (8pt base)
| Token | Value |
|-------|-------|
| `stack-sm` / `xs` | 8px |
| `stack-md` / `sm` | 12–16px |
| `stack-lg` / `lg` | 24–32px |
| `gutter` | 16–24px |
| `margin-desktop` | 64px |
| `margin-mobile` | 20px |

### Elevation & Depth
- Hierarchy via **tonal layering**, not harsh borders
- Shadows: warm-tinted (`rgba(61,43,31,0.10)`), large blur (15–20px), minimal offset
- Never use cool gray shadows — always warm umber tones
- Borders: Warm Stone at 20–30% opacity only

### Shape Language — "Gently Organic"
| Element | Radius |
|---------|--------|
| Cards, images | 16px |
| Buttons, inputs | 8px |
| Badges, pills | 9999px (full) |
| Icons | Rounded caps, no sharp 90° angles |
