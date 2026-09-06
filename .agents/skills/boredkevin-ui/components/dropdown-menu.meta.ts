import type { ComponentMeta } from '../schema/types';

export const dropdownMenuMeta: ComponentMeta = {
  name: 'DropdownMenu',
  exports: [
    'DropdownMenu',
    'DropdownMenuTrigger',
    'DropdownMenuContent',
    'DropdownMenuItem',
    'DropdownMenuCheckboxItem',
    'DropdownMenuRadioItem',
    'DropdownMenuLabel',
    'DropdownMenuSeparator',
    'DropdownMenuGroup',
    'DropdownMenuPortal',
    'DropdownMenuSub',
    'DropdownMenuSubContent',
    'DropdownMenuSubTrigger',
    'DropdownMenuRadioGroup',
  ],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/dropdown-menu',
  radixPrimitive: '@radix-ui/react-dropdown-menu',
  description:
    'Accessible overlay menu triggered by a button, supporting action items, nested submenus, checkboxes, and separators.',

  whenToUse: [
    'Contextual action menus (e.g. Table row actions, user profile menus).',
    'Filtering or sorting dropdowns.',
    'Quick action bars in headers.',
  ],

  whenNotToUse: [
    'Standard form selection inputs — use a select element.',
    'Modal dialogs requiring user input — use <Dialog>.',
  ],

  antiPatterns: [
    'DO NOT create custom absolute positioning menus with state toggles — use <DropdownMenu>.',
  ],

  composition: {
    required: ['DropdownMenuTrigger', 'DropdownMenuContent'],
    optional: [
      'DropdownMenuItem',
      'DropdownMenuLabel',
      'DropdownMenuSeparator',
      'DropdownMenuGroup',
      'DropdownMenuCheckboxItem',
      'DropdownMenuRadioGroup',
      'DropdownMenuRadioItem',
    ],
    rules: [
      'DropdownMenuTrigger with asChild wraps the trigger Button.',
      'DropdownMenuContent contains items, labels, and separators.',
    ],
  },

  props: [
    {
      name: 'open',
      type: 'boolean',
      description: 'Controlled open state of the dropdown.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean) => void',
      description: 'Event callback fired on open/close.',
    },
  ],

  tokens: [
    { cssVar: '--popover', role: 'dropdown menu surface background' },
    { cssVar: '--popover-foreground', role: 'dropdown text color' },
    { cssVar: '--border', role: 'dropdown border and separator' },
  ],

  relatedComponents: ['Button', 'Dialog', 'Table'],

  aiHints: [
    "Always use <DropdownMenuTrigger asChild><Button … /></DropdownMenuTrigger>.",
  ],

  examples: [
    {
      label: 'Actions menu',
      code: `import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button
} from '@boredkevin/ui';

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">Options</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Node Controls</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Status Overview</DropdownMenuItem>
    <DropdownMenuItem>Security Logs</DropdownMenuItem>
    <DropdownMenuItem className="text-destructive">Disconnect</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    },
  ],
};

export default dropdownMenuMeta;
