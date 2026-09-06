---
name: boredkevin-ui-dropdown-menu
description: >
  Use when building, styling, or updating DropdownMenu (DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup) with @boredkevin/ui.
  Accessible overlay menu triggered by a button, supporting action items, nested submenus, checkboxes, and separators.
---

# DropdownMenu — @boredkevin/ui Component Skill

> Accessible overlay menu triggered by a button, supporting action items, nested submenus, checkboxes, and separators.

- **Package Import**: `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-dropdown-menu`
- **Online Documentation**: [DropdownMenu Documentation](https://ui.bkev.in/docs/components/dropdown-menu)

---

## When to Reach for DropdownMenu
- Contextual action menus (e.g. Table row actions, user profile menus).
- Filtering or sorting dropdowns.
- Quick action bars in headers.

## When NOT to Use DropdownMenu
- Standard form selection inputs — use a select element.
- Modal dialogs requiring user input — use <Dialog>.

---

## Anti-Patterns
- ❌ DO NOT create custom absolute positioning menus with state toggles — use <DropdownMenu>.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | — | Controlled open state of the dropdown. |
| `onOpenChange` | `(open: boolean) => void` | — | Event callback fired on open/close. |


### Composition Rules
- **Required Sub-components**: `<DropdownMenuTrigger>`, `<DropdownMenuContent>`
- **Optional Sub-components**: `<DropdownMenuItem>`, `<DropdownMenuLabel>`, `<DropdownMenuSeparator>`, `<DropdownMenuGroup>`, `<DropdownMenuCheckboxItem>`, `<DropdownMenuRadioGroup>`, `<DropdownMenuRadioItem>`
- DropdownMenuTrigger with asChild wraps the trigger Button.
- DropdownMenuContent contains items, labels, and separators.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--popover` | — | dropdown menu surface background |
| `--popover-foreground` | — | dropdown text color |
| `--border` | — | dropdown border and separator |

## AI Guidelines & Implementation Hints
- 💡 Always use <DropdownMenuTrigger asChild><Button … /></DropdownMenuTrigger>.

---

## Ready-to-Use Examples

#### Actions menu
```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button
} from '@boredkevin/ui';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Node Controls</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Status Overview</DropdownMenuItem>
    <DropdownMenuItem>Security Logs</DropdownMenuItem>
    <DropdownMenuItem className="text-destructive">Disconnect</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```
