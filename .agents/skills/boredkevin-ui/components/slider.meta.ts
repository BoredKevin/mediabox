import type { ComponentMeta } from '../schema/types';

export const sliderMeta: ComponentMeta = {
  name: 'Slider',
  exports: ['Slider'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/slider',
  radixPrimitive: '@radix-ui/react-slider',
  description:
    'Precision range slider input for adjusting numeric parameters, opacity, speed, and volume.',

  whenToUse: [
    'Adjusting values along a continuous or stepped range (e.g. particle count, blur, opacity, volume).',
    'Audio, graphic, or theme parameter adjustment panels.',
  ],

  whenNotToUse: [
    'Discrete textual selection — use select or radio group.',
  ],

  antiPatterns: [
    'DO NOT use raw HTML <input type="range"> — always use <Slider>.',
  ],

  props: [
    {
      name: 'value',
      type: 'number[]',
      description: 'Controlled array of slider values (e.g. [50]).',
    },
    {
      name: 'defaultValue',
      type: 'number[]',
      description: 'Uncontrolled default slider values (e.g. [25]).',
    },
    {
      name: 'min',
      type: 'number',
      defaultValue: '0',
      description: 'Minimum value.',
    },
    {
      name: 'max',
      type: 'number',
      defaultValue: '100',
      description: 'Maximum value.',
    },
    {
      name: 'step',
      type: 'number',
      defaultValue: '1',
      description: 'Step increment.',
    },
    {
      name: 'onValueChange',
      type: '(value: number[]) => void',
      description: 'Callback fired during dragging.',
    },
  ],

  tokens: [
    { cssVar: '--primary', role: 'slider range fill' },
    { cssVar: '--secondary', role: 'slider track background' },
  ],

  relatedComponents: ['Switch', 'Input', 'Card'],

  aiHints: [
    "Note that Radix Slider uses number[] for value and defaultValue props (e.g. defaultValue={[50]}).",
  ],

  examples: [
    {
      label: 'Parameter slider',
      code: `import { Slider } from '@boredkevin/ui';

<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="font-medium">Glass Blur</span>
    <span className="font-mono text-muted-foreground">16px</span>
  </div>
  <Slider defaultValue={[16]} max={40} min={0} step={1} />
</div>`,
    },
  ],
};

export default sliderMeta;
