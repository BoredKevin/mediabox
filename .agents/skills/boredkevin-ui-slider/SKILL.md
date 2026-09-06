---
name: boredkevin-ui-slider
description: >
  Use when building, styling, or updating Slider (Slider) with @boredkevin/ui.
  Precision range slider input for adjusting numeric parameters, opacity, speed, and volume.
---

# Slider — @boredkevin/ui Component Skill

> Precision range slider input for adjusting numeric parameters, opacity, speed, and volume.

- **Package Import**: `import { Slider } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-slider`
- **Online Documentation**: [Slider Documentation](https://ui.bkev.in/docs/components/slider)

---

## When to Reach for Slider
- Adjusting values along a continuous or stepped range (e.g. particle count, blur, opacity, volume).
- Audio, graphic, or theme parameter adjustment panels.

## When NOT to Use Slider
- Discrete textual selection — use select or radio group.

---

## Anti-Patterns
- ❌ DO NOT use raw HTML <input type="range"> — always use <Slider>.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number[]` | — | Controlled array of slider values (e.g. [50]). |
| `defaultValue` | `number[]` | — | Uncontrolled default slider values (e.g. [25]). |
| `min` | `number` | `0` | Minimum value. |
| `max` | `number` | `100` | Maximum value. |
| `step` | `number` | `1` | Step increment. |
| `onValueChange` | `(value: number[]) => void` | — | Callback fired during dragging. |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | — | slider range fill |
| `--secondary` | — | slider track background |

## AI Guidelines & Implementation Hints
- 💡 Note that Radix Slider uses number[] for value and defaultValue props (e.g. defaultValue={[50]}).

---

## Ready-to-Use Examples

#### Parameter slider
```tsx
import { Slider } from '@boredkevin/ui';

<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="font-medium">Glass Blur</span>
    <span className="font-mono text-muted-foreground">16px</span>
  </div>
  <Slider defaultValue={[16]} max={40} min={0} step={1} />
</div>
```
