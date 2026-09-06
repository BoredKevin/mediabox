---
name: boredkevin-ui-tabs
description: >
  Use when building, styling, or updating Tabs (Tabs, TabsList, TabsTrigger, TabsContent) with @boredkevin/ui.
  Tabbed content navigation panels with sharp triggers and keyboard arrow navigation.
---

# Tabs — @boredkevin/ui Component Skill

> Tabbed content navigation panels with sharp triggers and keyboard arrow navigation.

- **Package Import**: `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-tabs`
- **Online Documentation**: [Tabs Documentation](https://ui.bkev.in/docs/components/tabs)

---

## When to Reach for Tabs
- Switching between views or categories in a single page or card.
- Settings sub-sections (e.g. Account, Security, Notifications).
- Dashboard widget tab switchers.

## When NOT to Use Tabs
- Multi-page routing — use standard link navigation or sidebar layout.
- Accordion collapsing panels — use <Accordion>.

---

## Anti-Patterns
- ❌ DO NOT create custom tab state logic — Radix Tabs handles controlled/uncontrolled state natively.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultValue` | `string` | — | Initial active tab value when uncontrolled. |
| `value` | `string` | — | Controlled active tab value. |
| `onValueChange` | `(value: string) => void` | — | Callback fired when active tab changes. |


### Composition Rules
- **Required Sub-components**: `<TabsList>`, `<TabsTrigger>`, `<TabsContent>`
- TabsList contains all TabsTrigger items.
- Each TabsTrigger value must match the corresponding TabsContent value.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--muted` | — | tabs list background |
| `--background` | — | active trigger background |

## AI Guidelines & Implementation Hints
- 💡 Always ensure every TabsTrigger has a matching TabsContent with the same 'value'.

---

## Ready-to-Use Examples

#### Standard tab navigation
```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@boredkevin/ui';

<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full max-w-xs grid-cols-2">
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="logs">Logs</TabsTrigger>
  </TabsList>
  <TabsContent value="overview" className="pt-4">
    <p className="text-sm text-muted-foreground">Node metrics and health stats.</p>
  </TabsContent>
  <TabsContent value="logs" className="pt-4">
    <p className="text-sm text-muted-foreground">Real-time system event stream.</p>
  </TabsContent>
</Tabs>
```
