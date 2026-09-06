---
name: boredkevin-ui-card
description: >
  Use when building, styling, or updating Card (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) with @boredkevin/ui.
  Sci-fi HUD container with optional liquid-glass frosted material, L-bracket corner edge lines, and a telemetry label. The primary surface primitive for grouping related content.
---

# Card — @boredkevin/ui Component Skill

> Sci-fi HUD container with optional liquid-glass frosted material, L-bracket corner edge lines, and a telemetry label. The primary surface primitive for grouping related content.

- **Package Import**: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@boredkevin/ui';`

- **Online Documentation**: [Card Documentation](https://ui.bkev.in/docs/components/card)

---

## When to Reach for Card
- Wrapping a group of related content (stats, forms, settings sections, data panels).
- Dashboard widgets and metric panels.
- Feature showcase sections.
- Any container that needs the library's signature frosted glass + corner-edges aesthetic.

## When NOT to Use Card
- Navigation menus — use <DropdownMenu> or a sidebar layout.
- Notifications / alerts — use <Badge> or a custom alert component.
- Modal dialogs — use <Dialog>.
- Simple inline sections with no visual boundary needed.

---

## Anti-Patterns
- ❌ DO NOT use a raw <div> with border + bg-card classes — always use <Card>.
- ❌ DO NOT skip <CardHeader> and go straight to <CardContent> if there is a title — use the full composition.
- ❌ DO NOT set cornerLines={false} unless you have a specific reason; the corner lines are the brand identity.
- ❌ DO NOT hard-code background or border colors — they come from CSS variables.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `cornerLines` | `boolean` | `true` | Renders L-bracket corner edge decorators. Default true — the signature sci-fi look. |
| `telemetry` | `string` | — | Optional HUD label string shown at top-right corner (e.g. "SYS.01", "NODE-A"). Font-mono, tiny, all-caps. |
| `glow` | `boolean` | `false` | Adds neon drop-shadow glow to the corner edge lines. |
| `liquidGlass` | `boolean` | `true` | Applies frosted glass backdrop-filter material. Disable only on fully opaque backgrounds. |
| `className` | `string` | — | Additional Tailwind classes merged via cn(). |


### Composition Rules
- **Optional Sub-components**: `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardContent>`, `<CardFooter>`
- CardTitle and CardDescription must be inside CardHeader.
- CardContent holds the main body content (p-6 pt-0 padding built in).
- CardFooter holds bottom actions (flex items-center layout built in).
- CornerEdges is rendered automatically by Card when cornerLines={true} (default).

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--card` | `bg-card` | card surface color |
| `--card-foreground` | `text-card-foreground` | card text color |
| `--border` | `border-border` | card border color |
| `--glass-blur` | — | backdrop blur depth for liquid glass |
| `--glass-opacity` | — | card surface opacity in glass mode |
| `--primary` | — | corner edge line color |
| `--corner-highlight-length` | — | corner line length (px) |

## AI Guidelines & Implementation Hints
- 💡 Card + telemetry prop is the canonical way to add HUD-style data panel labels (e.g. telemetry='SYS.01').
- 💡 Use <CardHeader><CardTitle>…</CardTitle><CardDescription>…</CardDescription></CardHeader> before <CardContent>.
- 💡 Add glow={true} to corner-edged cards for emphasis — use sparingly, not on every card.
- 💡 In dashboard grids, place <Card> inside a CSS grid container: <div className='grid grid-cols-3 gap-4'>.

---

## Ready-to-Use Examples

#### Standard telemetry card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '@boredkevin/ui';

<Card telemetry="SYS.ALPHA-01" className="w-full max-w-sm">
  <CardHeader>
    <div className="flex items-center justify-between">
      <Badge variant="success">ONLINE</Badge>
      <span className="font-mono text-xs text-muted-foreground">0ms</span>
    </div>
    <CardTitle>System Node</CardTitle>
    <CardDescription>Real-time telemetry feed from cluster alpha.</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">All subsystems nominal.</p>
  </CardContent>
  <CardFooter className="gap-2">
    <Button variant="cyber" size="sm" className="w-full">Connect</Button>
    <Button variant="outline" size="sm" className="w-full">Inspect</Button>
  </CardFooter>
</Card>
```

#### Metric panel (no footer)
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@boredkevin/ui';

<Card className="p-0">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
      Total Requests
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold tabular-nums">1,284,091</p>
    <p className="text-xs text-emerald-400 mt-1">↑ 12.4% vs last period</p>
  </CardContent>
</Card>
```
