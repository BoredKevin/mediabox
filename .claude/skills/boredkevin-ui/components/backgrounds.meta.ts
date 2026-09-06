import type { ComponentMeta } from '../schema/types';

export const backgroundsMeta: ComponentMeta = {
  name: 'Backgrounds',
  exports: [
    'CanvasBackground',
    'ConstellationsBackground',
    'PerlinNoiseBackground',
    'AtmosphericAuroraBackground',
  ],
  importPath: '@boredkevin/ui',
  docsUrl: 'https://ui.bkev.in/docs/backgrounds',
  description:
    'Hardware-accelerated 60fps canvas backgrounds and fluid aurora ambient lighting layers for pitch-dark sci-fi interfaces.',

  whenToUse: [
    'Adding atmospheric motion to full-page layouts, hero sections, or cards.',
    'Constellations: star-node webbing with mouse repulsion.',
    'PerlinNoise: organic mathematical flow-field streamlines.',
    'AtmosphericAurora: liquid glass ambient color orbs.',
    'CanvasBackground: unified background that automatically adapts to the active ThemeProvider preset.',
  ],

  whenNotToUse: [
    'High-frequency redraw overlays inside small dialogs or tooltips.',
  ],

  antiPatterns: [
    'DO NOT import AuroraBackground — the export name is AtmosphericAuroraBackground.',
    'DO NOT place backgrounds without setting relative on the parent and relative z-10 on the content layer.',
  ],

  props: [
    {
      name: 'particleCount',
      type: 'number',
      description: 'Number of particles/nodes (ConstellationsBackground & PerlinNoiseBackground).',
    },
    {
      name: 'maxDistance',
      type: 'number',
      description: 'Max distance in px between nodes to draw a line (ConstellationsBackground, default 140).',
    },
    {
      name: 'speed',
      type: 'number',
      description: 'Particle drift speed (ConstellationsBackground, default 0.7).',
    },
    {
      name: 'starSize',
      type: 'number',
      description: 'Radius of each star node in pixels (ConstellationsBackground, default 2).',
    },
    {
      name: 'glow',
      type: 'boolean',
      description: 'Enables neon glow on particles (ConstellationsBackground, default true).',
    },
    {
      name: 'interactive',
      type: 'boolean',
      description: 'Enables mouse repulsion interaction (ConstellationsBackground & PerlinNoiseBackground).',
    },
    {
      name: 'noiseScale',
      type: 'number',
      description: 'Perlin noise field scale factor (PerlinNoiseBackground, default 0.003).',
    },
    {
      name: 'flowSpeed',
      type: 'number',
      description: 'Animation speed multiplier for Perlin flow field (PerlinNoiseBackground, default 0.8).',
    },
    {
      name: 'colorMode',
      type: "'theme' | 'aurora' | 'cyan' | 'emerald' | 'amber' | 'crimson' | 'monochrome' | 'custom'",
      description: 'Color palette for PerlinNoiseBackground (default "theme").',
    },
    {
      name: 'auroraColors',
      type: '[string, string, string]',
      description: 'Orb colors for AtmosphericAuroraBackground (default: ["var(--aurora-1)", "var(--aurora-2)", "var(--aurora-3)"]).',
    },
    {
      name: 'opacity',
      type: 'number',
      defaultValue: '0.25',
      description: 'Orb opacity for AtmosphericAuroraBackground.',
    },
    {
      name: 'blur',
      type: 'number',
      defaultValue: '130',
      description: 'Blur radius in px for AtmosphericAuroraBackground orbs.',
    },
  ],

  tokens: [
    { cssVar: '--primary', role: 'constellation line and star accent' },
    { cssVar: '--aurora-1', role: 'first ambient aurora orb color' },
    { cssVar: '--aurora-2', role: 'second ambient aurora orb color' },
    { cssVar: '--aurora-3', role: 'third ambient aurora orb color' },
  ],

  relatedComponents: ['Card'],

  aiHints: [
    "Use <CanvasBackground /> as a single drop-in background that responds automatically to theme changes.",
    "Place background as a sibling to content inside a container with 'relative min-h-screen' and put content in a 'relative z-10' container.",
  ],

  examples: [
    {
      label: 'Full-page animated background',
      code: `import { CanvasBackground, Card, CardHeader, CardTitle, CardContent } from '@boredkevin/ui';

<div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-6">
  <CanvasBackground />
  <div className="relative z-10 w-full max-w-md">
    <Card telemetry="NODE.01">
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Connected to system matrix.</p>
      </CardContent>
    </Card>
  </div>
</div>`,
    },
    {
      label: 'Constellations background',
      code: `import { ConstellationsBackground } from '@boredkevin/ui';

<ConstellationsBackground
  particleCount={80}
  maxDistance={140}
  speed={0.7}
  interactive={true}
/>`,
    },
  ],
};

export default backgroundsMeta;
