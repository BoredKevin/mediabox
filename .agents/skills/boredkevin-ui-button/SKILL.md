---
name: boredkevin-ui-button
description: >
  Use when building, styling, or updating Button (Button, buttonVariants) with @boredkevin/ui.
  Interactive trigger element styled with the @boredkevin/ui sci-fi aesthetic. Supports chamfered clip-paths, neon glow on hover, and icon composition.
---

# Button — @boredkevin/ui Component Skill

> Interactive trigger element styled with the @boredkevin/ui sci-fi aesthetic. Supports chamfered clip-paths, neon glow on hover, and icon composition.

- **Package Import**: `import { Button, buttonVariants } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-slot`
- **Online Documentation**: [Button Documentation](https://ui.bkev.in/docs/components/button)

---

## When to Reach for Button
- Any clickable action: form submission, navigation triggers, dialog actions, destructive operations.
- Primary CTA on a page — use variant="default" or variant="cyber".
- Secondary or tertiary actions — use variant="outline", "secondary", "ghost".
- Rendering a link that looks like a button — use asChild prop with <a>.
- Icon-only actions — use size="icon".

## When NOT to Use Button
- Displaying status or metadata labels — use <Badge> instead.
- Inline text actions in paragraphs — use a plain <a> or variant="link".
- Toggle switches — use <Switch>.
- Dropdown triggers — use <DropdownMenu> which provides its own trigger.

---

## Anti-Patterns
- ❌ DO NOT use raw <button> elements — always use <Button>.
- ❌ DO NOT hard-code colors or sizes with Tailwind utilities when a variant/size covers it.
- ❌ DO NOT create a custom "CyberButton" component — use variant="cyber".
- ❌ DO NOT use size="lg" for inline text links — use variant="link" instead.
- ❌ DO NOT put an <a> directly inside <Button> without the asChild prop.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link' \| 'cyber' \| 'white'` | `'default'` | Visual style of the button. |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Height and padding scale. Use "icon" for square icon-only buttons (h-9 w-9). |
| `chamfer` | `'auto' \| 'dual' \| 'top-right' \| 'bottom-right' \| 'all' \| 'none'` | `'auto'` | Controls the CSS clip-path chamfer style. 'auto' inherits from active ThemeConfig. 'dual' = top-right + bottom-left. Note: 'bottom-right' renders the same clip as 'top-right' internally. |
| `asChild` | `boolean` | `false` | Merges button behavior onto the immediate child via Radix Slot. Use with <a> for link-buttons. |
| `disabled` | `boolean` | `false` | Disables interactions and applies 50% opacity. |

### Supported Variants
| Variant | Description | When to Use |
|---|---|---|
| `default` | Filled solid button using --primary color. Full hover glow. | Main primary action on a page (e.g. "Save", "Submit", "Connect"). |
| `cyber` | Semi-transparent primary-tinted button with bright primary text and animated corner highlights on hover. Signature sci-fi style. | Hero CTAs, highlighted actions in dashboard panels, any place that needs maximum visual impact in the sci-fi theme. |
| `outline` | Chamfered glass outline button with corner highlight animations on hover. | Secondary actions alongside a primary button (e.g. "Cancel", "View Details"). |
| `secondary` | Muted fill using --secondary color. | Tertiary actions or grouped action buttons where none is primary. |
| `destructive` | Red-tinted button using --destructive color. | Irreversible or dangerous actions: "Delete", "Revoke", "Terminate". |
| `ghost` | Invisible until hovered; minimal visual footprint. | Toolbar icons, table row actions, collapse toggles. |
| `link` | Styled as a text hyperlink (primary color + underline on hover). | Inline text actions in paragraphs or captions. |
| `white` | Solid white fill that inverts to outline on hover. High contrast. | CTAs on dark/hero sections where maximum contrast is needed against a pitch-dark background. |


### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | `bg-primary` | default/cyber variant background |
| `--primary-foreground` | `text-primary-foreground` | text on primary background |
| `--destructive` | `bg-destructive` | destructive variant background |
| `--secondary` | `bg-secondary` | secondary variant background |
| `--ring` | — | focus ring color |
| `--chamfer-size` | — | clip-path corner cut depth (px) |
| `--corner-highlight-length` | — | corner highlight line length on hover |

## AI Guidelines & Implementation Hints
- 💡 Always import from '@boredkevin/ui', never from a sub-path.
- 💡 Use variant='cyber' as the hero CTA in sci-fi/dark themed UIs — it's the signature style.
- 💡 Icon buttons need size='icon' and a single Lucide icon child with h-4 w-4.
- 💡 For loading states, add disabled prop and a <Loader2 className='h-4 w-4 animate-spin' /> child.
- 💡 Use asChild with <a href='...'> for link-styled buttons; do not nest <a> inside <button>.

---

## Ready-to-Use Examples

#### Primary actions (default + cyber)
```tsx
import { Button } from '@boredkevin/ui';

<div className="flex gap-2">
  <Button variant="cyber">Launch Mission</Button>
  <Button variant="outline">Inspect</Button>
</div>
```

#### Icon button
```tsx
import { Button } from '@boredkevin/ui';
import { Settings } from 'lucide-react';

<Button variant="ghost" size="icon" aria-label="Open settings">
  <Settings className="h-4 w-4" />
</Button>
```

#### Loading state
```tsx
import { Button } from '@boredkevin/ui';
import { Loader2 } from 'lucide-react';

<Button disabled variant="secondary" className="gap-2">
  <Loader2 className="h-4 w-4 animate-spin" />
  Processing...
</Button>
```
