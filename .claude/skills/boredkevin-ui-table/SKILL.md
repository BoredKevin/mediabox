---
name: boredkevin-ui-table
description: >
  Use when building, styling, or updating Table (Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption) with @boredkevin/ui.
  High-density data table with pitch-dark borders, hover highlights, and tabular layout.
---

# Table — @boredkevin/ui Component Skill

> High-density data table with pitch-dark borders, hover highlights, and tabular layout.

- **Package Import**: `import { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption } from '@boredkevin/ui';`

- **Online Documentation**: [Table Documentation](https://ui.bkev.in/docs/components/table)

---

## When to Reach for Table
- Tabular data displays (metrics, telemetry logs, node lists, transaction histories).
- Dashboard overview tables.

## When NOT to Use Table
- Simple key-value pairs — use a flex/grid layout inside a <Card>.

---

## Anti-Patterns
- ❌ DO NOT use raw HTML <table>/<tr>/<td> without Table components.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | — | Additional Tailwind utility classes. |


### Composition Rules
- **Required Sub-components**: `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableHead>`, `<TableCell>`
- **Optional Sub-components**: `<TableFooter>`, `<TableCaption>`
- Table contains TableHeader and TableBody.
- TableHeader contains TableRow with TableHead cells.
- TableBody contains TableRow with TableCell cells.

### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--border` | — | row border divider |
| `--muted` | — | row hover state background |
| `--muted-foreground` | — | header text |

## AI Guidelines & Implementation Hints
- 💡 Wrap Table inside a <Card> or <CardContent> for clean padding and sci-fi border framing.

---

## Ready-to-Use Examples

#### Telemetry data table
```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge
} from '@boredkevin/ui';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Node ID</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Latency</TableHead>
      <TableHead className="text-right">Bandwidth</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-mono">NODE-ALPHA-01</TableCell>
      <TableCell><Badge variant="success">ONLINE</Badge></TableCell>
      <TableCell className="font-mono">12ms</TableCell>
      <TableCell className="text-right font-mono">1.2 GB/s</TableCell>
    </TableRow>
  </TableBody>
</Table>
```
