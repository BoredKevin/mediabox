---
name: boredkevin-ui-accordion
description: >
  Use when building, styling, or updating Accordion (Accordion, AccordionItem, AccordionTrigger, AccordionContent) with @boredkevin/ui.
  Expandable disclosure panels with smooth collapse animations and keyboard focus handling.
---

# Accordion — @boredkevin/ui Component Skill

> Expandable disclosure panels with smooth collapse animations and keyboard focus handling.

- **Package Import**: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@boredkevin/ui';`
- **Base Primitive**: `@radix-ui/react-accordion`
- **Online Documentation**: [Accordion Documentation](https://ui.bkev.in/docs/components/accordion)

---

## When to Reach for Accordion
- FAQs and collapsible help sections.
- Advanced settings sections with grouped configuration parameters.

## When NOT to Use Accordion
- Tab navigation across distinct application views — use <Tabs>.

---

## Anti-Patterns
- ❌ DO NOT omit the type prop on Accordion (requires type="single" or type="multiple").

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `'single' \| 'multiple'` | — | Whether one or multiple panels can be opened simultaneously. |
| `collapsible` | `boolean` | — | When type="single", allows closing the open panel by clicking it again. |


### Composition Rules
- **Required Sub-components**: `<AccordionItem>`, `<AccordionTrigger>`, `<AccordionContent>`
- Accordion requires a type prop ("single" or "multiple").
- Each AccordionItem must have a unique value prop.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--border` | — | accordion item border |
| `--foreground` | — | trigger title |

## AI Guidelines & Implementation Hints
- 💡 Always provide type="single" collapsible or type="multiple" to <Accordion>.

---

## Ready-to-Use Examples

#### Collapsible accordion
```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@boredkevin/ui';

<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>How does HSL dynamic theming work?</AccordionTrigger>
    <AccordionContent>
      Theme variables are converted and injected as CSS custom properties in real-time.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```
