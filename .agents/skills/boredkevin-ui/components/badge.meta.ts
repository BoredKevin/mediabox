import type { ComponentMeta } from '../schema/types';

export const badgeMeta: ComponentMeta = {
  name: 'Badge',
  exports: ['Badge', 'badgeVariants'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/badge',
  description:
    'Compact status pills and metadata indicators with tactical color tokens.',

  whenToUse: [
    'Displaying status indicators (e.g. ONLINE, OFFLINE, PENDING, WARNING).',
    'Tagging categories, versions, or counts on cards and tables.',
  ],

  whenNotToUse: [
    'Interactive action triggers — use <Button size="sm"> instead.',
    'Form toggles — use <Switch>.',
  ],

  antiPatterns: [
    'DO NOT use variant="cyber" on Badge — cyber variant only exists on Button. Use variant="success", "warning", or "outline" for badges.',
    'DO NOT attach onClick handlers to Badge without accessible keyboard support — use Button instead.',
  ],

  variants: [
    {
      name: 'default',
      description: 'Solid filled primary badge.',
      whenToUse: 'General tags and primary highlights.',
      exampleProps: { variant: 'default' },
    },
    {
      name: 'secondary',
      description: 'Subtle secondary background.',
      whenToUse: 'Muted tags, metadata, versions.',
      exampleProps: { variant: 'secondary' },
    },
    {
      name: 'destructive',
      description: 'Red danger badge for error or offline states.',
      whenToUse: 'Errors, failed jobs, critical alerts.',
      exampleProps: { variant: 'destructive' },
    },
    {
      name: 'outline',
      description: 'Bordered badge with transparent background.',
      whenToUse: 'Neutral status tags, table cell categories.',
      exampleProps: { variant: 'outline' },
    },
    {
      name: 'success',
      description: 'Emerald green glowing status pill.',
      whenToUse: 'Online states, passed checks, completed tasks.',
      exampleProps: { variant: 'success' },
    },
    {
      name: 'warning',
      description: 'Amber glowing status pill.',
      whenToUse: 'Pending states, warnings, rate limits.',
      exampleProps: { variant: 'warning' },
    },
  ],

  props: [
    {
      name: 'variant',
      type: "'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'",
      defaultValue: "'default'",
      description: 'Visual stylistic variant of the badge.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Additional Tailwind utility classes.',
    },
  ],

  tokens: [
    { cssVar: '--primary', role: 'default variant background' },
    { cssVar: '--secondary', role: 'secondary variant background' },
    { cssVar: '--destructive', role: 'destructive variant background' },
    { cssVar: '--border', role: 'outline variant border' },
  ],

  relatedComponents: ['Card', 'Table', 'Button'],

  aiHints: [
    "Use variant='success' for active/online statuses.",
    "Use variant='warning' for pending or degraded statuses.",
    "Use variant='destructive' for errors or stopped services.",
  ],

  examples: [
    {
      label: 'Status indicators',
      code: `import { Badge } from '@boredkevin/ui';

<div className="flex gap-2">
  <Badge variant="success">ONLINE</Badge>
  <Badge variant="warning">PENDING</Badge>
  <Badge variant="destructive">FAILED</Badge>
  <Badge variant="outline">v0.1.1</Badge>
</div>`,
    },
  ],
};

export default badgeMeta;
