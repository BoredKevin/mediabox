import type { ComponentMeta } from '../schema/types';

export const dialogMeta: ComponentMeta = {
  name: 'Dialog',
  exports: [
    'Dialog',
    'DialogPortal',
    'DialogOverlay',
    'DialogTrigger',
    'DialogClose',
    'DialogContent',
    'DialogHeader',
    'DialogFooter',
    'DialogTitle',
    'DialogDescription',
  ],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/dialog',
  radixPrimitive: '@radix-ui/react-dialog',
  description:
    'Accessible modal overlay powered by Radix UI with animated backdrop blur, keyboard trapping, and sci-fi styling.',

  whenToUse: [
    'Critical user confirmations (deleting a resource, revoking keys).',
    'Modal forms and multi-step dialog workflows.',
    'Detailed inspector views triggered from buttons.',
  ],

  whenNotToUse: [
    'Non-blocking contextual help — use <Tooltip>.',
    'Navigation menus — use <DropdownMenu>.',
  ],

  antiPatterns: [
    'DO NOT implement custom fixed-position modal divs — always use <Dialog>.',
    'DO NOT omit <DialogTitle> inside <DialogHeader> (needed for screen readers).',
    'DO NOT put raw action buttons in the body — place them inside <DialogFooter>.',
  ],

  composition: {
    required: ['DialogContent'],
    optional: ['DialogTrigger', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter', 'DialogClose'],
    rules: [
      'DialogTrigger with asChild wraps the trigger Button.',
      'DialogContent contains DialogHeader, body content, and DialogFooter.',
      'DialogTitle and DialogDescription should be inside DialogHeader.',
    ],
  },

  props: [
    {
      name: 'open',
      type: 'boolean',
      description: 'Controlled open state of the modal.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean) => void',
      description: 'Event callback fired when modal open state toggles.',
    },
  ],

  tokens: [
    { cssVar: '--background', role: 'modal surface background' },
    { cssVar: '--border', role: 'modal border' },
  ],

  relatedComponents: ['Button', 'Input', 'Card'],

  aiHints: [
    "Always use <DialogTrigger asChild><Button … /></DialogTrigger>.",
    "Place action buttons inside <DialogFooter className='gap-2'>.",
  ],

  examples: [
    {
      label: 'Confirmation modal',
      code: `import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button
} from '@boredkevin/ui';

<Dialog>
  <DialogTrigger asChild>
    <Button variant="destructive">Terminate Node</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Terminate System Node</DialogTitle>
      <DialogDescription>
        This will disconnect the node and flush all active buffers.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2">
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Confirm Termination</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>`,
    },
  ],
};

export default dialogMeta;
