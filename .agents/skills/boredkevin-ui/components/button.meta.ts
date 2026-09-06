import type { ComponentMeta } from '../schema/types';

export const buttonMeta: ComponentMeta = {
  name: 'Button',
  exports: ['Button', 'buttonVariants'],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/components/button',
  radixPrimitive: '@radix-ui/react-slot',
  description:
    'Interactive trigger element styled with the @boredkevin/ui sci-fi aesthetic. Supports chamfered clip-paths, neon glow on hover, and icon composition.',

  whenToUse: [
    'Any clickable action: form submission, navigation triggers, dialog actions, destructive operations.',
    'Primary CTA on a page — use variant="default" or variant="cyber".',
    'Secondary or tertiary actions — use variant="outline", "secondary", "ghost".',
    'Rendering a link that looks like a button — use asChild prop with <a>.',
    'Icon-only actions — use size="icon".',
  ],

  whenNotToUse: [
    'Displaying status or metadata labels — use <Badge> instead.',
    'Inline text actions in paragraphs — use a plain <a> or variant="link".',
    'Toggle switches — use <Switch>.',
    'Dropdown triggers — use <DropdownMenu> which provides its own trigger.',
  ],

  antiPatterns: [
    'DO NOT use raw <button> elements — always use <Button>.',
    'DO NOT hard-code colors or sizes with Tailwind utilities when a variant/size covers it.',
    'DO NOT create a custom "CyberButton" component — use variant="cyber".',
    'DO NOT use size="lg" for inline text links — use variant="link" instead.',
    'DO NOT put an <a> directly inside <Button> without the asChild prop.',
  ],

  variants: [
    {
      name: 'default',
      description: 'Filled solid button using --primary color. Full hover glow.',
      whenToUse: 'Main primary action on a page (e.g. "Save", "Submit", "Connect").',
      exampleProps: { variant: 'default' },
    },
    {
      name: 'cyber',
      description: 'Semi-transparent primary-tinted button with bright primary text and animated corner highlights on hover. Signature sci-fi style.',
      whenToUse: 'Hero CTAs, highlighted actions in dashboard panels, any place that needs maximum visual impact in the sci-fi theme.',
      exampleProps: { variant: 'cyber' },
    },
    {
      name: 'outline',
      description: 'Chamfered glass outline button with corner highlight animations on hover.',
      whenToUse: 'Secondary actions alongside a primary button (e.g. "Cancel", "View Details").',
      exampleProps: { variant: 'outline' },
    },
    {
      name: 'secondary',
      description: 'Muted fill using --secondary color.',
      whenToUse: 'Tertiary actions or grouped action buttons where none is primary.',
      exampleProps: { variant: 'secondary' },
    },
    {
      name: 'destructive',
      description: 'Red-tinted button using --destructive color.',
      whenToUse: 'Irreversible or dangerous actions: "Delete", "Revoke", "Terminate".',
      exampleProps: { variant: 'destructive' },
    },
    {
      name: 'ghost',
      description: 'Invisible until hovered; minimal visual footprint.',
      whenToUse: 'Toolbar icons, table row actions, collapse toggles.',
      exampleProps: { variant: 'ghost' },
    },
    {
      name: 'link',
      description: 'Styled as a text hyperlink (primary color + underline on hover).',
      whenToUse: 'Inline text actions in paragraphs or captions.',
      exampleProps: { variant: 'link' },
    },
    {
      name: 'white',
      description: 'Solid white fill that inverts to outline on hover. High contrast.',
      whenToUse: 'CTAs on dark/hero sections where maximum contrast is needed against a pitch-dark background.',
      exampleProps: { variant: 'white' },
    },
  ],

  props: [
    {
      name: 'variant',
      type: "'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'cyber' | 'white'",
      defaultValue: "'default'",
      description: 'Visual style of the button.',
    },
    {
      name: 'size',
      type: "'default' | 'sm' | 'lg' | 'icon'",
      defaultValue: "'default'",
      description: 'Height and padding scale. Use "icon" for square icon-only buttons (h-9 w-9).',
    },
    {
      name: 'chamfer',
      type: "'auto' | 'dual' | 'top-right' | 'bottom-right' | 'all' | 'none'",
      defaultValue: "'auto'",
      description: "Controls the CSS clip-path chamfer style. 'auto' inherits from active ThemeConfig. 'dual' = top-right + bottom-left. Note: 'bottom-right' renders the same clip as 'top-right' internally.",
    },
    {
      name: 'asChild',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Merges button behavior onto the immediate child via Radix Slot. Use with <a> for link-buttons.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      defaultValue: 'false',
      description: 'Disables interactions and applies 50% opacity.',
    },
  ],

  tokens: [
    { cssVar: '--primary', tailwindClass: 'bg-primary', role: 'default/cyber variant background' },
    { cssVar: '--primary-foreground', tailwindClass: 'text-primary-foreground', role: 'text on primary background' },
    { cssVar: '--destructive', tailwindClass: 'bg-destructive', role: 'destructive variant background' },
    { cssVar: '--secondary', tailwindClass: 'bg-secondary', role: 'secondary variant background' },
    { cssVar: '--ring', role: 'focus ring color' },
    { cssVar: '--chamfer-size', role: 'clip-path corner cut depth (px)' },
    { cssVar: '--corner-highlight-length', role: 'corner highlight line length on hover' },
  ],

  aiHints: [
    "Always import from '@boredkevin/ui', never from a sub-path.",
    "Use variant='cyber' as the hero CTA in sci-fi/dark themed UIs — it's the signature style.",
    "Icon buttons need size='icon' and a single Lucide icon child with h-4 w-4.",
    "For loading states, add disabled prop and a <Loader2 className='h-4 w-4 animate-spin' /> child.",
    "Use asChild with <a href='...'> for link-styled buttons; do not nest <a> inside <button>.",
  ],

  examples: [
    {
      label: 'Primary actions (default + cyber)',
      code: `import { Button } from '@boredkevin/ui';

<div className="flex gap-2">
  <Button variant="cyber">Launch Mission</Button>
  <Button variant="outline">Inspect</Button>
</div>`,
    },
    {
      label: 'Icon button',
      code: `import { Button } from '@boredkevin/ui';
import { Settings } from 'lucide-react';

<Button variant="ghost" size="icon" aria-label="Open settings">
  <Settings className="h-4 w-4" />
</Button>`,
    },
    {
      label: 'Loading state',
      code: `import { Button } from '@boredkevin/ui';
import { Loader2 } from 'lucide-react';

<Button disabled variant="secondary" className="gap-2">
  <Loader2 className="h-4 w-4 animate-spin" />
  Processing...
</Button>`,
    },
  ],
};

export default buttonMeta;
