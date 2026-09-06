---
name: boredkevin-ui-input
description: >
  Use when building, styling, or updating Input (Input) with @boredkevin/ui.
  Styled text input with glowing primary-color border on focus, frosted glass inner surface, and chamfer clip-path support.
---

# Input — @boredkevin/ui Component Skill

> Styled text input with glowing primary-color border on focus, frosted glass inner surface, and chamfer clip-path support.

- **Package Import**: `import { Input } from '@boredkevin/ui';`
- **Base Primitive**: `Native <input> wrapper with chamfer wrapper div`
- **Online Documentation**: [Input Documentation](https://ui.bkev.in/docs/components/input)

---

## When to Reach for Input
- Any single-line text entry: search, name, email, password, code.
- Form fields that collect user text input.

## When NOT to Use Input
- Multi-line text — use a styled textarea.
- Numeric range sliders — use <Slider>.
- Boolean toggles — use <Switch>.
- Date selection — use <Calendar>.

---

## Anti-Patterns
- ❌ DO NOT use a raw <input> element — always use <Input>.
- ❌ DO NOT add focus styles manually — they are built into the component.
- ❌ DO NOT wrap <Input> in another border div — the component has its own border/focus wrapper.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | `'text'` | HTML input type: 'text', 'email', 'password', 'number', 'search', etc. |
| `chamfer` | `'auto' \| 'dual' \| 'top-right' \| 'bottom-right' \| 'all' \| 'none'` | `'auto'` | Clip-path chamfer style. 'auto' inherits from ThemeConfig. |
| `placeholder` | `string` | — | Placeholder text displayed when empty. |
| `disabled` | `boolean` | `false` | Disables input and applies opacity styling. |
| `className` | `string` | — | Applied to the inner input element. |


### Composition Rules
- Pair <Input> with a <label> element placed above.
- Use a flex-col or space-y-1.5 container for label + input stacking.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--input` | `bg-input` | input border wrapper background |
| `--background` | `bg-background` | inner input surface color |
| `--primary` | — | focus ring glow color |
| `--muted-foreground` | — | placeholder text color |
| `--foreground` | — | input text color |

## AI Guidelines & Implementation Hints
- 💡 Focus state automatically renders a primary-color glow — do not add focus:ring classes.
- 💡 For search inputs, wrap in a relative container with an icon and add pl-8 to the Input className.

---

## Ready-to-Use Examples

#### Labeled input
```tsx
import { Input } from '@boredkevin/ui';

<div className="space-y-1.5">
  <label htmlFor="email" className="text-sm font-medium text-foreground">
    Email address
  </label>
  <Input id="email" type="email" placeholder="operator@system.io" />
</div>
```

#### Search input with icon
```tsx
import { Input } from '@boredkevin/ui';
import { Search } from 'lucide-react';

<div className="relative w-full max-w-sm">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
  <Input type="search" placeholder="Search nodes..." className="pl-8" />
</div>
```
