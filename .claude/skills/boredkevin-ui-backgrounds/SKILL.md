---
name: boredkevin-ui-backgrounds
description: >
  Use when building, styling, or updating Backgrounds (CanvasBackground, ConstellationsBackground, PerlinNoiseBackground, AtmosphericAuroraBackground) with @boredkevin/ui.
  Hardware-accelerated 60fps canvas backgrounds and fluid aurora ambient lighting layers for pitch-dark sci-fi interfaces.
---

# Backgrounds — @boredkevin/ui Component Skill

> Hardware-accelerated 60fps canvas backgrounds and fluid aurora ambient lighting layers for pitch-dark sci-fi interfaces.

- **Package Import**: `import { CanvasBackground, ConstellationsBackground, PerlinNoiseBackground, AtmosphericAuroraBackground } from '@boredkevin/ui';`

- **Online Documentation**: [Backgrounds Documentation](https://ui.bkev.in/docs/backgrounds)

---

## When to Reach for Backgrounds
- Adding atmospheric motion to full-page layouts, hero sections, or cards.
- Constellations: star-node webbing with mouse repulsion.
- PerlinNoise: organic mathematical flow-field streamlines.
- AtmosphericAurora: liquid glass ambient color orbs.
- CanvasBackground: unified background that automatically adapts to the active ThemeProvider preset.

## When NOT to Use Backgrounds
- High-frequency redraw overlays inside small dialogs or tooltips.

---

## Anti-Patterns
- ❌ DO NOT import AuroraBackground — the export name is AtmosphericAuroraBackground.
- ❌ DO NOT place backgrounds without setting relative on the parent and relative z-10 on the content layer.

---

## Props Reference
| Prop | Type | Default | Description |
|---|---|---|---|
| `particleCount` | `number` | — | Number of particles/nodes (ConstellationsBackground & PerlinNoiseBackground). |
| `maxDistance` | `number` | — | Max distance in px between nodes to draw a line (ConstellationsBackground, default 140). |
| `speed` | `number` | — | Particle drift speed (ConstellationsBackground, default 0.7). |
| `starSize` | `number` | — | Radius of each star node in pixels (ConstellationsBackground, default 2). |
| `glow` | `boolean` | — | Enables neon glow on particles (ConstellationsBackground, default true). |
| `interactive` | `boolean` | — | Enables mouse repulsion interaction (ConstellationsBackground & PerlinNoiseBackground). |
| `noiseScale` | `number` | — | Perlin noise field scale factor (PerlinNoiseBackground, default 0.003). |
| `flowSpeed` | `number` | — | Animation speed multiplier for Perlin flow field (PerlinNoiseBackground, default 0.8). |
| `colorMode` | `'theme' \| 'aurora' \| 'cyan' \| 'emerald' \| 'amber' \| 'crimson' \| 'monochrome' \| 'custom'` | — | Color palette for PerlinNoiseBackground (default "theme"). |
| `auroraColors` | `[string, string, string]` | — | Orb colors for AtmosphericAuroraBackground (default: ["var(--aurora-1)", "var(--aurora-2)", "var(--aurora-3)"]). |
| `opacity` | `number` | `0.25` | Orb opacity for AtmosphericAuroraBackground. |
| `blur` | `number` | `130` | Blur radius in px for AtmosphericAuroraBackground orbs. |



### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
| `--primary` | — | constellation line and star accent |
| `--aurora-1` | — | first ambient aurora orb color |
| `--aurora-2` | — | second ambient aurora orb color |
| `--aurora-3` | — | third ambient aurora orb color |

## AI Guidelines & Implementation Hints
- 💡 Use <CanvasBackground /> as a single drop-in background that responds automatically to theme changes.
- 💡 Place background as a sibling to content inside a container with 'relative min-h-screen' and put content in a 'relative z-10' container.

---

## Ready-to-Use Examples

#### Full-page animated background
```tsx
import { CanvasBackground, Card, CardHeader, CardTitle, CardContent } from '@boredkevin/ui';

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
</div>
```

#### Constellations background
```tsx
import { ConstellationsBackground } from '@boredkevin/ui';

<ConstellationsBackground
  particleCount={80}
  maxDistance={140}
  speed={0.7}
  interactive={true}
/>
```
