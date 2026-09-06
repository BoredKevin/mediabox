import type { ComponentMeta } from '../schema/types';

export const separatorMeta: ComponentMeta = {
  name: 'Separator',
  exports: ['Separator'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/separator',
  radixPrimitive: '@radix-ui/react-separator',
  description:
    'Visual divider line supporting horizontal and vertical orientations.',

  whenToUse: [
    'Dividing sections within cards, dialogs, or sidebar navigation lists.',
    'Separating actions in toolbars.',
  ],

  whenNotToUse: [
    'Adding border outlines to containers — use border utility classes on the container.',
  ],

  antiPatterns: [
    'DO NOT use raw <hr> tags — use <Separator>.',
  ],

  props: [
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      defaultValue: "'horizontal'",
      description: 'Orientation of the divider.',
    },
    {
      name: 'decorative',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Whether element is purely decorative (for ARIA).',
    },
  ],

  tokens: [
    { cssVar: '--border', tailwindClass: 'bg-border', role: 'separator line color' },
  ],

  relatedComponents: ['Card', 'DropdownMenu'],

  aiHints: [
    "Use orientation='vertical' inside flex rows with a defined height.",
  ],

  examples: [
    {
      label: 'Horizontal separator',
      code: `import { Separator } from '@boredkevin/ui';

<div className="space-y-4">
  <h4 className="text-sm font-medium">Subsystem Alpha</h4>
  <Separator />
  <p className="text-xs text-muted-foreground">Connected on port 443.</p>
</div>`,
    },
  ],
};

export default separatorMeta;
