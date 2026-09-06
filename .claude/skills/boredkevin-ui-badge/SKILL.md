---
name: boredkevin-ui-badge
description: >
  Use when building, styling, or updating Badge (Badge, badgeVariants) with @boredkevin/ui.
  Compact status pills and metadata indicators with tactical color tokens.
---

# Badge — @boredkevin/ui Component Skill

> Compact status pills and metadata indicators with tactical color tokens.

- **Package Import**: `import { Badge, badgeVariants } from '@boredkevin/ui';`

- **Online Documentation**: [Badge Documentation](https://ui.bkev.in/docs/components/badge)

---

## When to Reach for Badge
- Displaying status indicators (e.g. ONLINE, OFFLINE, PENDING, WARNING).
- Tagging categories, versions, or counts on cards and tables.

## When NOT to Use Badge
- Interactive action triggers — use <Button size="sm"> instead.
- Form toggles — use <Switch>.

---

## Anti-Patterns
- ❌ DO NOT use variant="cyber" on Badge — cyber variant only exists on Button. Use variant="success", "warning", or "outline" for badges.
- ❌ DO NOT attach onClick handlers to Badge without accessible keyboard support — use Button instead.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline' \| 'success' \| 'warning'` | `'default'` | Visual stylistic variant of the badge. |
| `className` | `string` | — | Additional Tailwind utility classes. |

### Supported Variants
| Variant | Description | When to Use |
|---|---|---|
| `default` | Solid filled primary badge. | General tags and primary highlights. |
| `secondary` | Subtle secondary background. | Muted tags, metadata, versions. |
| `destructive` | Red danger badge for error or offline states. | Errors, failed jobs, critical alerts. |
| `outline` | Bordered badge with transparent background. | Neutral status tags, table cell categories. |
| `success` | Emerald green glowing status pill. | Online states, passed checks, completed tasks. |
| `warning` | Amber glowing status pill. | Pending states, warnings, rate limits. |


### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | — | default variant background |
| `--secondary` | — | secondary variant background |
| `--destructive` | — | destructive variant background |
| `--border` | — | outline variant border |

## AI Guidelines & Implementation Hints
- 💡 Use variant='success' for active/online statuses.
- 💡 Use variant='warning' for pending or degraded statuses.
- 💡 Use variant='destructive' for errors or stopped services.

---

## Ready-to-Use Examples

#### Status indicators
```tsx
import { Badge } from '@boredkevin/ui';

<div className="flex gap-2">
  <Badge variant="success">ONLINE</Badge>
  <Badge variant="warning">PENDING</Badge>
  <Badge variant="destructive">FAILED</Badge>
  <Badge variant="outline">v0.1.1</Badge>
</div>
```
