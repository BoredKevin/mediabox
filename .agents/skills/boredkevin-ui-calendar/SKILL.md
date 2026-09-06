---
name: boredkevin-ui-calendar
description: >
  Use when building, styling, or updating Calendar (Calendar) with @boredkevin/ui.
  Compact date picker calendar with month navigation and high-contrast day selector.
---

# Calendar — @boredkevin/ui Component Skill

> Compact date picker calendar with month navigation and high-contrast day selector.

- **Package Import**: `import { Calendar } from '@boredkevin/ui';`

- **Online Documentation**: [Calendar Documentation](https://ui.bkev.in/docs/components/calendar)

---

## When to Reach for Calendar
- Date picking widgets in forms or scheduling popovers.
- Telemetry log date filtering.

## When NOT to Use Calendar
- Time selection — use an input.

---

## Anti-Patterns
- ❌ DO NOT place large full-page calendar layouts into <Calendar> — it is a compact picker primitive.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `selectedDate` | `number` | `6` | Currently selected day number. |
| `onSelectDate` | `(day: number) => void` | — | Callback triggered when user selects a day. |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--card` | — | calendar card background |
| `--foreground` | — | selected day background |
| `--muted` | — | hover state day background |

## AI Guidelines & Implementation Hints
- 💡 Wrap <Calendar> inside a <Card> or dropdown popover for date filtering.

---

## Ready-to-Use Examples

#### Calendar picker
```tsx
import { Calendar } from '@boredkevin/ui';

<Calendar onSelectDate={(day) => console.log('Selected day:', day)} />
```
