import type { ComponentMeta } from '../schema/types';

export const tooltipMeta: ComponentMeta = {
  name: 'Tooltip',
  exports: ['Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/tooltip',
  radixPrimitive: '@radix-ui/react-tooltip',
  description:
    'Instant contextual help popups triggered on hover and focus.',

  whenToUse: [
    'Explaining icon buttons with no visible text.',
    'Hover hints on truncated text or metrics.',
  ],

  whenNotToUse: [
    'Complex interactive menus — use <DropdownMenu>.',
    'Long-form explanations — use inline text or <CardDescription>.',
  ],

  antiPatterns: [
    'DO NOT place interactive buttons inside TooltipContent.',
  ],

  composition: {
    required: ['Tooltip', 'TooltipTrigger', 'TooltipContent'],
    optional: ['TooltipProvider'],
    rules: [
      'Wrap root or app in TooltipProvider or place it around the Tooltip.',
      'TooltipTrigger with asChild wraps the trigger element.',
    ],
  },

  props: [
    {
      name: 'delayDuration',
      type: 'number',
      defaultValue: '700',
      description: 'Hover delay before showing tooltip (ms).',
    },
  ],

  tokens: [
    { cssVar: '--popover', role: 'tooltip background' },
    { cssVar: '--popover-foreground', role: 'tooltip text' },
    { cssVar: '--border', role: 'tooltip border' },
  ],

  relatedComponents: ['Button'],

  aiHints: [
    "Always provide a Tooltip for icon-only buttons to enhance accessibility.",
  ],

  examples: [
    {
      label: 'Icon button with tooltip',
      code: `import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Button
} from '@boredkevin/ui';
import { HelpCircle } from 'lucide-react';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Help">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Telemetry port 8080 active</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>`,
    },
  ],
};

export default tooltipMeta;
