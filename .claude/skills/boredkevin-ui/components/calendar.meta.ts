import type { ComponentMeta } from '../schema/types';

export const calendarMeta: ComponentMeta = {
  name: 'Calendar',
  exports: ['Calendar'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/calendar',
  description:
    'Compact date picker calendar with month navigation and high-contrast day selector.',

  whenToUse: [
    'Date picking widgets in forms or scheduling popovers.',
    'Telemetry log date filtering.',
  ],

  whenNotToUse: [
    'Time selection — use an input.',
  ],

  antiPatterns: [
    'DO NOT place large full-page calendar layouts into <Calendar> — it is a compact picker primitive.',
  ],

  props: [
    {
      name: 'selectedDate',
      type: 'number',
      defaultValue: '6',
      description: 'Currently selected day number.',
    },
    {
      name: 'onSelectDate',
      type: '(day: number) => void',
      description: 'Callback triggered when user selects a day.',
    },
  ],

  tokens: [
    { cssVar: '--card', role: 'calendar card background' },
    { cssVar: '--foreground', role: 'selected day background' },
    { cssVar: '--muted', role: 'hover state day background' },
  ],

  relatedComponents: ['Card', 'Popover', 'Dialog'],

  aiHints: [
    "Wrap <Calendar> inside a <Card> or dropdown popover for date filtering.",
  ],

  examples: [
    {
      label: 'Calendar picker',
      code: `import { Calendar } from '@boredkevin/ui';

<Calendar onSelectDate={(day) => console.log('Selected day:', day)} />`,
    },
  ],
};

export default calendarMeta;
