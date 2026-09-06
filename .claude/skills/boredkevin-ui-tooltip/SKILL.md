---
name: boredkevin-ui-tooltip
description: >
  Use when building, styling, or updating Tooltip (Tooltip, TooltipTrigger, TooltipContent, TooltipProvider) with @boredkevin/ui.
  Instant contextual help popups triggered on hover and focus.
---

# Tooltip — @boredkevin/ui Component Skill

> Instant contextual help popups triggered on hover and focus.

- **Package Import**: `import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-tooltip`
- **Online Documentation**: [Tooltip Documentation](https://ui.bkev.in/docs/components/tooltip)

---

## When to Reach for Tooltip
- Explaining icon buttons with no visible text.
- Hover hints on truncated text or metrics.

## When NOT to Use Tooltip
- Complex interactive menus — use <DropdownMenu>.
- Long-form explanations — use inline text or <CardDescription>.

---

## Anti-Patterns
- ❌ DO NOT place interactive buttons inside TooltipContent.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `delayDuration` | `number` | `700` | Hover delay before showing tooltip (ms). |


### Composition Rules
- **Required Sub-components**: `<Tooltip>`, `<TooltipTrigger>`, `<TooltipContent>`
- **Optional Sub-components**: `<TooltipProvider>`
- Wrap root or app in TooltipProvider or place it around the Tooltip.
- TooltipTrigger with asChild wraps the trigger element.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--popover` | — | tooltip background |
| `--popover-foreground` | — | tooltip text |
| `--border` | — | tooltip border |

## AI Guidelines & Implementation Hints
- 💡 Always provide a Tooltip for icon-only buttons to enhance accessibility.

---

## Ready-to-Use Examples

#### Icon button with tooltip
```tsx
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button
} from '@boredkevin/ui';
import { HelpCircle } from 'lucide-react';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Help">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Telemetry port 8080 active</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```
