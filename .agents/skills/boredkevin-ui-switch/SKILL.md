---
name: boredkevin-ui-switch
description: >
  Use when building, styling, or updating Switch (Switch) with @boredkevin/ui.
  Two-state boolean toggle switch with sharp corners and primary color fill on active state.
---

# Switch — @boredkevin/ui Component Skill

> Two-state boolean toggle switch with sharp corners and primary color fill on active state.

- **Package Import**: `import { Switch } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-switch`
- **Online Documentation**: [Switch Documentation](https://ui.bkev.in/docs/components/switch)

---

## When to Reach for Switch
- Toggle settings (e.g. Ambient lighting, Telemetry stream, Dark mode).
- Binary on/off preferences.

## When NOT to Use Switch
- Submitting forms with multiple choice options — use radio or select.

---

## Anti-Patterns
- ❌ DO NOT use raw checkbox inputs when a toggle switch is intended.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | — | Controlled checked state. |
| `onCheckedChange` | `(checked: boolean) => void` | — | Callback fired when checked state changes. |
| `disabled` | `boolean` | — | Disables switch interaction. |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | — | active switch background |
| `--input` | — | inactive switch background |

## AI Guidelines & Implementation Hints
- 💡 Always pair <Switch> with a <label> describing the setting.

---

## Ready-to-Use Examples

#### Setting toggle item
```tsx
import { Switch } from '@boredkevin/ui';

<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <label htmlFor="telemetry-toggle" className="text-sm font-medium">
      Real-time Telemetry
    </label>
    <p className="text-xs text-muted-foreground">Stream live system events</p>
  </div>
  <Switch id="telemetry-toggle" defaultChecked />
</div>
```
