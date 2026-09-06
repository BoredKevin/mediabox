import type { ComponentMeta } from '../schema/types';

export const tableMeta: ComponentMeta = {
  name: 'Table',
  exports: [
    'Table',
    'TableHeader',
    'TableBody',
    'TableFooter',
    'TableHead',
    'TableRow',
    'TableCell',
    'TableCaption',
  ],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/table',
  description:
    'High-density data table with pitch-dark borders, hover highlights, and tabular layout.',

  whenToUse: [
    'Tabular data displays (metrics, telemetry logs, node lists, transaction histories).',
    'Dashboard overview tables.',
  ],

  whenNotToUse: [
    'Simple key-value pairs — use a flex/grid layout inside a <Card>.',
  ],

  antiPatterns: [
    'DO NOT use raw HTML <table>/<tr>/<td> without Table components.',
  ],

  composition: {
    required: ['TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell'],
    optional: ['TableFooter', 'TableCaption'],
    rules: [
      'Table contains TableHeader and TableBody.',
      'TableHeader contains TableRow with TableHead cells.',
      'TableBody contains TableRow with TableCell cells.',
    ],
  },

  props: [
    {
      name: 'className',
      type: 'string',
      description: 'Additional Tailwind utility classes.',
    },
  ],

  tokens: [
    { cssVar: '--border', role: 'row border divider' },
    { cssVar: '--muted', role: 'row hover state background' },
    { cssVar: '--muted-foreground', role: 'header text' },
  ],

  relatedComponents: ['Card', 'Badge', 'Button', 'DropdownMenu'],

  aiHints: [
    'Wrap Table inside a <Card> or <CardContent> for clean padding and sci-fi border framing.',
  ],

  examples: [
    {
      label: 'Telemetry data table',
      code: `import {
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
</Table>`,
    },
  ],
};

export default tableMeta;
