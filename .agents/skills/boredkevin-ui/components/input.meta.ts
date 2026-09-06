import type { ComponentMeta } from '../schema/types';

export const inputMeta: ComponentMeta = {
  name: 'Input',
  exports: ['Input'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/input',
  radixPrimitive: 'Native <input> wrapper with chamfer wrapper div',
  description:
    'Styled text input with glowing primary-color border on focus, frosted glass inner surface, and chamfer clip-path support.',

  whenToUse: [
    'Any single-line text entry: search, name, email, password, code.',
    'Form fields that collect user text input.',
  ],

  whenNotToUse: [
    'Multi-line text — use a styled textarea.',
    'Numeric range sliders — use <Slider>.',
    'Boolean toggles — use <Switch>.',
    'Date selection — use <Calendar>.',
  ],

  antiPatterns: [
    'DO NOT use a raw <input> element — always use <Input>.',
    'DO NOT add focus styles manually — they are built into the component.',
    'DO NOT wrap <Input> in another border div — the component has its own border/focus wrapper.',
  ],

  props: [
    {
      name: 'type',
      type: 'string',
      defaultValue: "'text'",
      description: "HTML input type: 'text', 'email', 'password', 'number', 'search', etc.",
    },
    {
      name: 'chamfer',
      type: "'auto' | 'dual' | 'top-right' | 'bottom-right' | 'all' | 'none'",
      defaultValue: "'auto'",
      description: "Clip-path chamfer style. 'auto' inherits from ThemeConfig.",
    },
    {
      name: 'placeholder',
      type: 'string',
      description: 'Placeholder text displayed when empty.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Disables input and applies opacity styling.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Applied to the inner input element.',
    },
  ],

  tokens: [
    { cssVar: '--input', tailwindClass: 'bg-input', role: 'input border wrapper background' },
    { cssVar: '--background', tailwindClass: 'bg-background', role: 'inner input surface color' },
    { cssVar: '--primary', role: 'focus ring glow color' },
    { cssVar: '--muted-foreground', role: 'placeholder text color' },
    { cssVar: '--foreground', role: 'input text color' },
  ],

  composition: {
    rules: [
      'Pair <Input> with a <label> element placed above.',
      'Use a flex-col or space-y-1.5 container for label + input stacking.',
    ],
  },

  relatedComponents: ['Button', 'Switch', 'Slider'],

  aiHints: [
    "Focus state automatically renders a primary-color glow — do not add focus:ring classes.",
    "For search inputs, wrap in a relative container with an icon and add pl-8 to the Input className.",
  ],

  examples: [
    {
      label: 'Labeled input',
      code: `import { Input } from '@boredkevin/ui';

<div className="space-y-1.5">
  <label htmlFor="email" className="text-sm font-medium text-foreground">
    Email address
  </label>
  <Input id="email" type="email" placeholder="operator@system.io" />
</div>`,
    },
    {
      label: 'Search input with icon',
      code: `import { Input } from '@boredkevin/ui';
import { Search } from 'lucide-react';

<div className="relative w-full max-w-sm">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
  <Input type="search" placeholder="Search nodes..." className="pl-8" />
</div>`,
    },
  ],
};

export default inputMeta;
