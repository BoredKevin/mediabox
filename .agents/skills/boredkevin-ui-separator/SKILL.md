---
name: boredkevin-ui-separator
description: >
  Use when building, styling, or updating Separator (Separator) with @boredkevin/ui.
  Visual divider line supporting horizontal and vertical orientations.
---

# Separator — @boredkevin/ui Component Skill

> Visual divider line supporting horizontal and vertical orientations.

- **Package Import**: `import { Separator } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-separator`
- **Online Documentation**: [Separator Documentation](https://ui.bkev.in/docs/components/separator)

---

## When to Reach for Separator
- Dividing sections within cards, dialogs, or sidebar navigation lists.
- Separating actions in toolbars.

## When NOT to Use Separator
- Adding border outlines to containers — use border utility classes on the container.

---

## Anti-Patterns
- ❌ DO NOT use raw <hr> tags — use <Separator>.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Orientation of the divider. |
| `decorative` | `boolean` | `true` | Whether element is purely decorative (for ARIA). |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--border` | `bg-border` | separator line color |

## AI Guidelines & Implementation Hints
- 💡 Use orientation='vertical' inside flex rows with a defined height.

---

## Ready-to-Use Examples

#### Horizontal separator
```tsx
import { Separator } from '@boredkevin/ui';

<div className="space-y-4">
  <h4 className="text-sm font-medium">Subsystem Alpha</h4>
  <Separator />
  <p className="text-xs text-muted-foreground">Connected on port 443.</p>
</div>
```
