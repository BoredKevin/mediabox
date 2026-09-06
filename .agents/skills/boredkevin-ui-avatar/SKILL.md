---
name: boredkevin-ui-avatar
description: >
  Use when building, styling, or updating Avatar (Avatar, AvatarImage, AvatarFallback) with @boredkevin/ui.
  User representation with image loading fallback, sharp border radius, and muted background.
---

# Avatar — @boredkevin/ui Component Skill

> User representation with image loading fallback, sharp border radius, and muted background.

- **Package Import**: `import { Avatar, AvatarImage, AvatarFallback } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-avatar`
- **Online Documentation**: [Avatar Documentation](https://ui.bkev.in/docs/components/avatar)

---

## When to Reach for Avatar
- User profile headers, account switchers, author representations.
- System agent identifiers.

## When NOT to Use Avatar
- General image thumbnails with arbitrary aspect ratios.

---

## Anti-Patterns
- ❌ DO NOT omit <AvatarFallback> when rendering <AvatarImage>.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | — | Additional Tailwind classes for sizing (e.g. h-8 w-8). |


### Composition Rules
- **Required Sub-components**: `<AvatarFallback>`
- **Optional Sub-components**: `<AvatarImage>`
- Avatar contains AvatarImage and AvatarFallback.
- AvatarFallback displays when image fails to load or is loading.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--muted` | — | avatar fallback background |
| `--border` | — | avatar border |

## AI Guidelines & Implementation Hints
- 💡 Always provide a 2-letter uppercase initials string in <AvatarFallback>.

---

## Ready-to-Use Examples

#### User avatar with fallback
```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@boredkevin/ui';

<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
  <AvatarFallback>BK</AvatarFallback>
</Avatar>
```
