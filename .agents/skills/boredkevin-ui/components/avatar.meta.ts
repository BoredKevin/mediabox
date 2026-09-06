import type { ComponentMeta } from '../schema/types';

export const avatarMeta: ComponentMeta = {
  name: 'Avatar',
  exports: ['Avatar', 'AvatarImage', 'AvatarFallback'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/avatar',
  radixPrimitive: '@radix-ui/react-avatar',
  description:
    'User representation with image loading fallback, sharp border radius, and muted background.',

  whenToUse: [
    'User profile headers, account switchers, author representations.',
    'System agent identifiers.',
  ],

  whenNotToUse: [
    'General image thumbnails with arbitrary aspect ratios.',
  ],

  antiPatterns: [
    'DO NOT omit <AvatarFallback> when rendering <AvatarImage>.',
  ],

  composition: {
    required: ['AvatarFallback'],
    optional: ['AvatarImage'],
    rules: [
      'Avatar contains AvatarImage and AvatarFallback.',
      'AvatarFallback displays when image fails to load or is loading.',
    ],
  },

  props: [
    {
      name: 'className',
      type: 'string',
      description: 'Additional Tailwind classes for sizing (e.g. h-8 w-8).',
    },
  ],

  tokens: [
    { cssVar: '--muted', role: 'avatar fallback background' },
    { cssVar: '--border', role: 'avatar border' },
  ],

  relatedComponents: ['DropdownMenu', 'Card'],

  aiHints: [
    "Always provide a 2-letter uppercase initials string in <AvatarFallback>.",
  ],

  examples: [
    {
      label: 'User avatar with fallback',
      code: `import { Avatar, AvatarImage, AvatarFallback } from '@boredkevin/ui';

<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
  <AvatarFallback>BK</AvatarFallback>
</Avatar>`,
    },
  ],
};

export default avatarMeta;
