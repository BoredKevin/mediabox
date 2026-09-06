import type { ComponentMeta } from '../schema/types';

export const switchMeta: ComponentMeta = {
  name: 'Switch',
  exports: ['Switch'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/switch',
  radixPrimitive: '@radix-ui/react-switch',
  description:
    'Two-state boolean toggle switch with sharp corners and primary color fill on active state.',

  whenToUse: [
    'Toggle settings (e.g. Ambient lighting, Telemetry stream, Dark mode).',
    'Binary on/off preferences.',
  ],

  whenNotToUse: [
    'Submitting forms with multiple choice options — use radio or select.',
  ],

  antiPatterns: [
    'DO NOT use raw checkbox inputs when a toggle switch is intended.',
  ],

  props: [
    {
      name: 'checked',
      type: 'boolean',
      description: 'Controlled checked state.',
    },
    {
      name: 'onCheckedChange',
      type: '(checked: boolean) => void',
      description: 'Callback fired when checked state changes.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      description: 'Disables switch interaction.',
    },
  ],

  tokens: [
    { cssVar: '--primary', role: 'active switch background' },
    { cssVar: '--input', role: 'inactive switch background' },
  ],

  relatedComponents: ['Input', 'Slider', 'Card'],

  aiHints: [
    "Always pair <Switch> with a <label> describing the setting.",
  ],

  examples: [
    {
      label: 'Setting toggle item',
      code: `import { Switch } from '@boredkevin/ui';

<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <label htmlFor="telemetry-toggle" className="text-sm font-medium">
      Real-time Telemetry
    </label>
    <p className="text-xs text-muted-foreground">Stream live system events</p>
  </div>
  <Switch id="telemetry-toggle" defaultChecked />
</div>`,
    },
  ],
};

export default switchMeta;
