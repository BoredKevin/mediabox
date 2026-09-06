import type { ComponentMeta } from '../schema/types';

export const cornerEdgesMeta: ComponentMeta = {
  name: 'CornerEdges',
  exports: ['CornerEdges'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/corner-edges',
  description:
    'Standalone sci-fi HUD bracket framing system that renders 4 corner tick marks and an optional telemetry code inside any relative container.',

  whenToUse: [
    'Adding sci-fi HUD framing to custom containers, panels, or image frames.',
    'Displaying a telemetry label (e.g. "SYS.01") at the top-right corner.',
    'Custom hero elements that require tactical corner brackets.',
  ],

  whenNotToUse: [
    'Standard card containers — <Card> already renders <CornerEdges> automatically when cornerLines={true}.',
  ],

  antiPatterns: [
    'DO NOT place <CornerEdges> inside a container without position: relative (or className="relative").',
    'DO NOT pass a variant prop — CornerEdges uses glow and color props instead.',
  ],

  props: [
    {
      name: 'size',
      type: 'number',
      defaultValue: '10',
      description: 'Length of each corner bracket arm in pixels.',
    },
    {
      name: 'thickness',
      type: 'number',
      defaultValue: '2',
      description: 'Thickness of the bracket line in pixels.',
    },
    {
      name: 'glow',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Enables a soft neon drop-shadow glow around each bracket.',
    },
    {
      name: 'color',
      type: 'string',
      description: 'Tailwind text/border color class (defaults to text-primary).',
    },
    {
      name: 'corners',
      type: "('tl' | 'tr' | 'bl' | 'br')[]",
      defaultValue: "['tl', 'tr', 'bl', 'br']",
      description: 'Which corners to render.',
    },
    {
      name: 'telemetry',
      type: 'string',
      description: 'Optional HUD code label rendered at the top right.',
    },
  ],

  tokens: [
    { cssVar: '--primary', role: 'default bracket color and glow source' },
    { cssVar: '--border', role: 'telemetry label border' },
  ],

  relatedComponents: ['Card'],

  aiHints: [
    "Always ensure the parent element has 'relative' positioning.",
    "<Card> already renders CornerEdges by default — only use CornerEdges directly when building custom container shapes.",
  ],

  examples: [
    {
      label: 'Custom framed container',
      code: `import { CornerEdges } from '@boredkevin/ui';

<div className="relative p-6 bg-card border border-border">
  <CornerEdges size={10} glow={true} telemetry="SEC.04" />
  <h3 className="text-lg font-bold">Encrypted Node</h3>
  <p className="text-sm text-muted-foreground">Protected by hardware boundary.</p>
</div>`,
    },
  ],
};

export default cornerEdgesMeta;
