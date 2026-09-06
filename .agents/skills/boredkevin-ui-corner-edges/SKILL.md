---
name: boredkevin-ui-corner-edges
description: >
  Use when building, styling, or updating CornerEdges (CornerEdges) with @boredkevin/ui.
  Standalone sci-fi HUD bracket framing system that renders 4 corner tick marks and an optional telemetry code inside any relative container.
---

# CornerEdges — @boredkevin/ui Component Skill

> Standalone sci-fi HUD bracket framing system that renders 4 corner tick marks and an optional telemetry code inside any relative container.

- **Package Import**: `import { CornerEdges } from '@boredkevin/ui';`

- **Online Documentation**: [CornerEdges Documentation](https://ui.bkev.in/docs/components/corner-edges)

---

## When to Reach for CornerEdges
- Adding sci-fi HUD framing to custom containers, panels, or image frames.
- Displaying a telemetry label (e.g. "SYS.01") at the top-right corner.
- Custom hero elements that require tactical corner brackets.

## When NOT to Use CornerEdges
- Standard card containers — <Card> already renders <CornerEdges> automatically when cornerLines={true}.

---

## Anti-Patterns
- ❌ DO NOT place <CornerEdges> inside a container without position: relative (or className="relative").
- ❌ DO NOT pass a variant prop — CornerEdges uses glow and color props instead.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `number` | `10` | Length of each corner bracket arm in pixels. |
| `thickness` | `number` | `2` | Thickness of the bracket line in pixels. |
| `glow` | `boolean` | `false` | Enables a soft neon drop-shadow glow around each bracket. |
| `color` | `string` | — | Tailwind text/border color class (defaults to text-primary). |
| `corners` | `('tl' \| 'tr' \| 'bl' \| 'br')[]` | `['tl', 'tr', 'bl', 'br']` | Which corners to render. |
| `telemetry` | `string` | — | Optional HUD code label rendered at the top right. |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | — | default bracket color and glow source |
| `--border` | — | telemetry label border |

## AI Guidelines & Implementation Hints
- 💡 Always ensure the parent element has 'relative' positioning.
- 💡 <Card> already renders CornerEdges by default — only use CornerEdges directly when building custom container shapes.

---

## Ready-to-Use Examples

#### Custom framed container
```tsx
import { CornerEdges } from '@boredkevin/ui';

<div className="relative p-6 bg-card border border-border">
  <CornerEdges size={10} glow={true} telemetry="SEC.04" />
  <h3 className="text-lg font-bold">Encrypted Node</h3>
  <p className="text-sm text-muted-foreground">Protected by hardware boundary.</p>
</div>
```
