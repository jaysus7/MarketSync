# MarketSync Master Design System

**Single Source of Truth Design Architecture**
- **Brand**: MarketSync
- **Tagline**: *"One dealership. One system."*
- **Flagship Application**: DealerOS by MarketSync
- **Intelligence Layer**: Embedded Intelligence ("Intelligence built into the system—not bolted onto it")

---

## 1. Design System Principles

1. **Precision Automotive Infrastructure**: Engineered like premium automotive retail software — clean, high-contrast, operationally efficient, and restrained (Apple-like quality).
2. **Token-Driven Light & Dark Modes**: Light mode defaults to Warm White (`#F7F8FA`) canvas with Graphite (`#17191F`) type; Dark mode defaults to Dark Canvas (`#121318`) with Surface Raised (`#1A1D24`) cards and Border (`#2B303A`).
3. **Market Blue Primary Action**: All primary interactive triggers use Market Blue (`#2563EB`) with Dealer Blue (`#1F4ED8`) hover states.
4. **No Unnecessary Framework Dependencies**: Centralized in [`marketplace-frontend/css/marketsync-theme.css`](file:///Users/jasonmassie/Documents/MarketSync%20Main/MarketSync-main/MarketSync/marketplace-frontend/css/marketsync-theme.css) using native CSS custom properties.

---

## 2. Token Architecture & Reference

### Brand & Palette Primitives
```css
/* Core Brand Colors */
--ms-blue-500: #2563EB; /* Market Blue (Primary Action) */
--ms-blue-600: #1F4ED8; /* Dealer Blue (Hover/Active) */
--ms-blue-700: #153AA6; /* Deep Blue (Focus/Active) */

/* Neutrals */
--ms-white: #FFFFFF;
--ms-warm-white: #F7F8FA;
--ms-gray-50: #F9FAFB;
--ms-gray-100: #F3F4F6;
--ms-gray-200: #E5E7EB;
--ms-gray-300: #D1D5DB;
--ms-gray-400: #9CA3AF;
--ms-gray-500: #6B7280;
--ms-gray-600: #4B5563;
--ms-gray-700: #374151;
--ms-gray-800: #1F2937;
--ms-graphite: #17191F;

/* Dark Surfaces */
--ms-dark-canvas: #121318;
--ms-dark-surface-1: #1A1D24;
--ms-dark-surface-2: #222630;
--ms-dark-border: #2B303A;
--ms-dark-text-primary: #F7F8FA;
--ms-dark-text-secondary: #A5ACB8;
```

### Semantic Tokens (Always Consume These)
```css
--color-bg                /* Page Canvas Background */
--color-surface           /* Card / Modal Surface */
--color-surface-raised    /* Raised Panel Surface */
--color-surface-hover     /* Row / Item Hover State */
--color-text              /* Primary Body Type */
--color-text-secondary    /* Subheadings & Labels */
--color-text-muted        /* Metadata & Captions */
--color-border            /* Default Dividers & Borders */
--color-border-strong     /* Emphasized Outlines */
--color-primary           /* Primary Triggers & Active Links (#2563EB) */
--color-primary-hover     /* Hover State (#1F4ED8) */
--color-primary-soft      /* Light Blue Pill & Badge Fill */
--color-focus             /* Focus Ring Ring Accent (#2563EB) */
```

---

## 3. Typography & Hierarchy

- **Primary Font**: `Manrope` (Headings, Metrics, Display Type)
- **UI Font**: `Inter` (Inputs, Table Data, Compact UI)

| Utility Class | Size / Weight | Line Height | Application |
|---|---|---|---|
| `.ms-display` | `60px` (`3.75rem`) / 900 | 1.05 | Marketing Hero Display |
| `.ms-h1` | `44px` (`2.75rem`) / 900 | 1.10 | Major Page Titles |
| `.ms-h2` | `32px` (`2.00rem`) / 800 | 1.15 | Section Headings |
| `.ms-h3` | `24px` (`1.50rem`) / 800 | 1.20 | Subsection Headings |
| `.ms-ui-title`| `18px` (`1.125rem`) / 700| 1.30 | Card Headers / Modal Titles |
| `.ms-body` | `16px` (`1.00rem`) / 400 | 1.50 | Standard Body Prose |
| `.ms-label` | `14px` (`0.875rem`) / 700| 1.40 | Form Field Labels |
| `.ms-meta` | `12px` (`0.75rem`) / 600 | 1.40 | Metadata / Timestamps |

---

## 4. Spacing & Radius Systems

### 8px Spacing Grid
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--space-10`: `40px`
- `--space-12`: `48px`
- `--space-16`: `64px`

### Radius Rules
- `--radius-xs`: `6px` (Tiny indicators & tags)
- `--radius-sm`: `8px` (Table rows & small controls)
- `--radius-md`: `12px` (Buttons, inputs, select dropdowns)
- `--radius-lg`: `16px` (Cards, table containers)
- `--radius-xl`: `20px` (Modals, drawers)
- `--radius-2xl`: `24px` (Large panels & hero containers)
- `--radius-pill`: `9999px` (Badges, rounded chips)

---

## 5. Core Component Primitives

### Buttons
```html
<button class="ms-btn ms-btn-md ms-btn-primary">Primary Action</button>
<button class="ms-btn ms-btn-md ms-btn-secondary">Secondary Action</button>
<button class="ms-btn ms-btn-md ms-btn-tertiary">Tertiary Action</button>
<button class="ms-btn ms-btn-md ms-btn-ghost">Ghost Button</button>
<button class="ms-btn ms-btn-md ms-btn-danger">Delete / Reject</button>
```

### Cards & Metrics
```html
<div class="ms-card ms-card-metric">
  <span class="label">Gross Sales MTD</span>
  <span class="value">$284,910</span>
</div>
```

### Operational Tables
```html
<div class="ms-table-wrap">
  <table class="ms-table ms-table-compact">
    <thead>
      <tr>
        <th>Customer</th>
        <th>Department</th>
        <th>Status</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>John Doe</td>
        <td>SalesOS</td>
        <td><span class="ms-badge ms-badge-success">Delivered</span></td>
        <td>$42,500.00</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 6. Official Brand Logos

Canonical logo asset:
- Primary brand logo: `/logo.png` (`marketplace-frontend/logo.png`)
- Favicon: `/favicon.png` (`marketplace-frontend/favicon.png`)

Use the official PNG logo asset directly across all headers, navigation bars, and authentication card headers. Never redraw or recreate logo marks.

---

## 7. Department Identity Accents

Departments share the DealerOS design system while utilizing subtle blue-family accents:
- **SalesOS**: Amber / Gold
- **InventoryOS**: Sky Blue
- **F&IOS**: Indigo
- **CleanupOS**: Teal / Cyan
- **ServiceOS**: Steel Blue
- **PartsOS**: Warm Amber
- **AccountingOS**: Emerald
- **MarketingOS**: Violet
- **HROS**: Slate Emerald
