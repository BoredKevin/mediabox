---
name: boredkevin-ui-dialog
description: >
  Use when building, styling, or updating Dialog (Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription) with @boredkevin/ui.
  Accessible modal overlay powered by Radix UI with animated backdrop blur, keyboard trapping, and sci-fi styling.
---

# Dialog — @boredkevin/ui Component Skill

> Accessible modal overlay powered by Radix UI with animated backdrop blur, keyboard trapping, and sci-fi styling.

- **Package Import**: `import { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-dialog`
- **Online Documentation**: [Dialog Documentation](https://ui.bkev.in/docs/components/dialog)

---

## When to Reach for Dialog
- Critical user confirmations (deleting a resource, revoking keys).
- Modal forms and multi-step dialog workflows.
- Detailed inspector views triggered from buttons.

## When NOT to Use Dialog
- Non-blocking contextual help — use <Tooltip>.
- Navigation menus — use <DropdownMenu>.

---

## Anti-Patterns
- ❌ DO NOT implement custom fixed-position modal divs — always use <Dialog>.
- ❌ DO NOT omit <DialogTitle> inside <DialogHeader> (needed for screen readers).
- ❌ DO NOT put raw action buttons in the body — place them inside <DialogFooter>.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | — | Controlled open state of the modal. |
| `onOpenChange` | `(open: boolean) => void` | — | Event callback fired when modal open state toggles. |


### Composition Rules
- **Required Sub-components**: `<DialogContent>`
- **Optional Sub-components**: `<DialogTrigger>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>`, `<DialogClose>`
- DialogTrigger with asChild wraps the trigger Button.
- DialogContent contains DialogHeader, body content, and DialogFooter.
- DialogTitle and DialogDescription should be inside DialogHeader.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--background` | — | modal surface background |
| `--border` | — | modal border |

## AI Guidelines & Implementation Hints
- 💡 Always use <DialogTrigger asChild><Button … /></DialogTrigger>.
- 💡 Place action buttons inside <DialogFooter className='gap-2'>.

---

## Ready-to-Use Examples

#### Confirmation modal
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button
} from '@boredkevin/ui';

<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Terminate Node</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Terminate System Node</DialogTitle>
      <DialogDescription>
        This will disconnect the node and flush all active buffers.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2">
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Confirm Termination</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
