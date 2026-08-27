# CSS ownership (Batch 1)

| File | Owns | Must not own |
|---|---|---|
| `css/ms-design-system.css` | Tokens, type, materials, buttons, inputs, modal primitives | Page layouts, department content |
| `css/marketsync-theme.css` | Composition of public + DealerOS + HQ surfaces, Liquid Glass application | New primitive tokens that belong in the design system |
| `css/dashboard-nav.css` | Sidebar / header / mobile bar layout | Brand color invention |
| `css/dashboard-brand-repaint.css` | Temporary indigo utility → Market Blue map | New features. Do not grow this file. |
| `assets/public-shell.css` | Public header/footer/nav composition | Dashboard workspace styles |
| `css/tailwind-built.css` | Utility compile only | Hand-authored brand tokens |

Rebuild Tailwind after token/font changes; do not hand-edit `tailwind-built.css`.
