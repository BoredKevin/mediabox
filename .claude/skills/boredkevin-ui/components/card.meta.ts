import type { ComponentMeta } from '../schema/types';

export const cardMeta: ComponentMeta = {
  name: 'Card',
  exports: ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/card',
  description:
    'Sci-fi HUD container with optional liquid-glass frosted material, L-bracket corner edge lines, and a telemetry label. The primary surface primitive for grouping related content.',

  whenToUse: [
    'Wrapping a group of related content (stats, forms, settings sections, data panels).',
    'Dashboard widgets and metric panels.',
    'Feature showcase sections.',
    'Any container that needs the library\'s signature frosted glass + corner-edges aesthetic.',
  ],

  whenNotToUse: [
    'Navigation menus — use <DropdownMenu> or a sidebar layout.',
    'Notifications / alerts — use <Badge> or a custom alert component.',
    'Modal dialogs — use <Dialog>.',
    'Simple inline sections with no visual boundary needed.',
  ],

  antiPatterns: [
    'DO NOT use a raw <div> with border + bg-card classes — always use <Card>.',
    'DO NOT skip <CardHeader> and go straight to <CardContent> if there is a title — use the full composition.',
    'DO NOT set cornerLines={false} unless you have a specific reason; the corner lines are the brand identity.',
    'DO NOT hard-code background or border colors — they come from CSS variables.',
  ],

  composition: {
    required: [],
    optional: ['CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter'],
    rules: [
      'CardTitle and CardDescription must be inside CardHeader.',
      'CardContent holds the main body content (p-6 pt-0 padding built in).',
      'CardFooter holds bottom actions (flex items-center layout built in).',
      'CornerEdges is rendered automatically by Card when cornerLines={true} (default).',
    ],
  },

  props: [
    {
      name: 'cornerLines',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Renders L-bracket corner edge decorators. Default true — the signature sci-fi look.',
    },
    {
      name: 'telemetry',
      type: 'string',
      description: 'Optional HUD label string shown at top-right corner (e.g. "SYS.01", "NODE-A"). Font-mono, tiny, all-caps.',
    },
    {
      name: 'glow',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Adds neon drop-shadow glow to the corner edge lines.',
    },
    {
      name: 'liquidGlass',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Applies frosted glass backdrop-filter material. Disable only on fully opaque backgrounds.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Additional Tailwind classes merged via cn().',
    },
  ],

  tokens: [
    { cssVar: '--card', tailwindClass: 'bg-card', role: 'card surface color' },
    { cssVar: '--card-foreground', tailwindClass: 'text-card-foreground', role: 'card text color' },
    { cssVar: '--border', tailwindClass: 'border-border', role: 'card border color' },
    { cssVar: '--glass-blur', role: 'backdrop blur depth for liquid glass' },
    { cssVar: '--glass-opacity', role: 'card surface opacity in glass mode' },
    { cssVar: '--primary', role: 'corner edge line color' },
    { cssVar: '--corner-highlight-length', role: 'corner line length (px)' },
  ],

  relatedComponents: ['CornerEdges', 'Badge', 'Button', 'Separator'],

  aiHints: [
    "Card + telemetry prop is the canonical way to add HUD-style data panel labels (e.g. telemetry='SYS.01').",
    "Use <CardHeader><CardTitle>…</CardTitle><CardDescription>…</CardDescription></CardHeader> before <CardContent>.",
    "Add glow={true} to corner-edged cards for emphasis — use sparingly, not on every card.",
    "In dashboard grids, place <Card> inside a CSS grid container: <div className='grid grid-cols-3 gap-4'>.",
  ],

  examples: [
    {
      label: 'Standard telemetry card',
      code: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge } from '@boredkevin/ui';

<Card telemetry="SYS.ALPHA-01" className="w-full max-w-sm">
  <CardHeader>
    <div className="flex items-center justify-between">
      <Badge variant="success">ONLINE</Badge>
      <span className="font-mono text-xs text-muted-foreground">0ms</span>
    </div>
    <CardTitle>System Node</CardTitle>
    <CardDescription>Real-time telemetry feed from cluster alpha.</CardDescription>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">All subsystems nominal.</p>
  </CardContent>
  <CardFooter className="gap-2">
    <Button variant="cyber" size="sm" className="w-full">Connect</Button>
    <Button variant="outline" size="sm" className="w-full">Inspect</Button>
  </CardFooter>
</Card>`,
    },
    {
      label: 'Metric panel (no footer)',
      code: `import { Card, CardHeader, CardTitle, CardContent } from '@boredkevin/ui';

<Card className="p-0">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
      Total Requests
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-3xl font-bold tabular-nums">1,284,091</p>
    <p className="text-xs text-emerald-400 mt-1">↑ 12.4% vs last period</p>
  </CardContent>
</Card>`,
    },
  ],
};

export default cardMeta;
