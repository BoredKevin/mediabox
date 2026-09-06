import type { ComponentMeta } from '../schema/types';

export const accordionMeta: ComponentMeta = {
  name: 'Accordion',
  exports: ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/accordion',
  radixPrimitive: '@radix-ui/react-accordion',
  description:
    'Expandable disclosure panels with smooth collapse animations and keyboard focus handling.',

  whenToUse: [
    'FAQs and collapsible help sections.',
    'Advanced settings sections with grouped configuration parameters.',
  ],

  whenNotToUse: [
    'Tab navigation across distinct application views — use <Tabs>.',
  ],

  antiPatterns: [
    'DO NOT omit the type prop on Accordion (requires type="single" or type="multiple").',
  ],

  composition: {
    required: ['AccordionItem', 'AccordionTrigger', 'AccordionContent'],
    rules: [
      'Accordion requires a type prop ("single" or "multiple").',
      'Each AccordionItem must have a unique value prop.',
    ],
  },

  props: [
    {
      name: 'type',
      type: "'single' | 'multiple'",
      required: true,
      description: 'Whether one or multiple panels can be opened simultaneously.',
    },
    {
      name: 'collapsible',
      type: 'boolean',
      description: 'When type="single", allows closing the open panel by clicking it again.',
    },
  ],

  tokens: [
    { cssVar: '--border', role: 'accordion item border' },
    { cssVar: '--foreground', role: 'trigger title' },
  ],

  relatedComponents: ['Card', 'Tabs'],

  aiHints: [
    'Always provide type="single" collapsible or type="multiple" to <Accordion>.',
  ],

  examples: [
    {
      label: 'Collapsible accordion',
      code: `import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from '@boredkevin/ui';

<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>How does HSL dynamic theming work?</AccordionTrigger>
    <AccordionContent>
      Theme variables are converted and injected as CSS custom properties in real-time.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
  ],
};

export default accordionMeta;
