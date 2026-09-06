import type { ComponentMeta } from '../schema/types';

export const tabsMeta: ComponentMeta = {
  name: 'Tabs',
  exports: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/tabs',
  radixPrimitive: '@radix-ui/react-tabs',
  description:
    'Tabbed content navigation panels with sharp triggers and keyboard arrow navigation.',

  whenToUse: [
    'Switching between views or categories in a single page or card.',
    'Settings sub-sections (e.g. Account, Security, Notifications).',
    'Dashboard widget tab switchers.',
  ],

  whenNotToUse: [
    'Multi-page routing — use standard link navigation or sidebar layout.',
    'Accordion collapsing panels — use <Accordion>.',
  ],

  antiPatterns: [
    'DO NOT create custom tab state logic — Radix Tabs handles controlled/uncontrolled state natively.',
  ],

  composition: {
    required: ['TabsList', 'TabsTrigger', 'TabsContent'],
    rules: [
      'TabsList contains all TabsTrigger items.',
      'Each TabsTrigger value must match the corresponding TabsContent value.',
    ],
  },

  props: [
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Initial active tab value when uncontrolled.',
    },
    {
      name: 'value',
      type: 'string',
      description: 'Controlled active tab value.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      description: 'Callback fired when active tab changes.',
    },
  ],

  tokens: [
    { cssVar: '--muted', role: 'tabs list background' },
    { cssVar: '--background', role: 'active trigger background' },
  ],

  relatedComponents: ['Card', 'Table'],

  aiHints: [
    "Always ensure every TabsTrigger has a matching TabsContent with the same 'value'.",
  ],

  examples: [
    {
      label: 'Standard tab navigation',
      code: `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@boredkevin/ui';

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
</Tabs>`,
    },
  ],
};

export default tabsMeta;
