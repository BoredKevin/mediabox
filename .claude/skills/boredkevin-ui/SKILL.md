---
name: boredkevin-ui
description: >
  Rules for AI assistants generating React UI code with @boredkevin/ui —
  a precision-crafted, sci-fi themed, pitch-dark design system built on Radix UI + Tailwind CSS v3.
version: "0.1.1"
docsUrl: "https://ui.bkev.in/docs"
llmsUrl: "https://ui.bkev.in/llms.txt"
metaDir: "ai-skill/components/"
---

# @boredkevin/ui — AI Assistant Skill

## Purpose

This skill teaches AI assistants how to correctly use `@boredkevin/ui`.
**Always read `ai-skill/design.json` and the relevant `ai-skill/components/*.meta.ts` files before generating UI.**

The library is a *sci-fi / HUD aesthetic* component set. It is NOT a generic SaaS UI library.
Target aesthetics: pitch-dark backgrounds, chamfered clip-path corners, neon primary-color glows, liquid-glass frosted surfaces, and constellation / perlin-flow / fluid aurora animated canvas backgrounds.

---

## 0. Setup Checklist (Required Every Time)

Before generating any component code, verify:

1. `@boredkevin/ui` is installed: `npm install @boredkevin/ui lucide-react`
2. CSS is imported at app root: `import '@boredkevin/ui/theme.css';`
3. The app tree is wrapped in `<ThemeProvider>` from `@boredkevin/ui`
4. `tailwind.config.js` includes `'./node_modules/@boredkevin/ui/**/*.{js,mjs,ts,tsx}'` in `content`

```tsx
// src/App.tsx — minimal correct setup
import React from 'react';
import { ThemeProvider } from '@boredkevin/ui';
import '@boredkevin/ui/theme.css';

export default function App() {
  return (
    <ThemeProvider>
      {/* your app */}
    </ThemeProvider>
  );
}
```

---

## 1. Component Priority Order

When building UI, reach for components in this order:

1. **Layout surfaces**: `<Card>` (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`)
2. **Actions**: `<Button>` (never raw `<button>`)
3. **Forms**: `<Input>` (never raw `<input>`), `<Switch>`, `<Slider>`, `<Calendar>`
4. **Feedback**: `<Badge>` (`default | secondary | destructive | outline | success | warning`), `<Dialog>`, `<Tooltip>`
5. **Navigation**: `<Tabs>`, `<DropdownMenu>`, `<Accordion>`
6. **Data & Structure**: `<Table>`, `<Separator>`, `<Avatar>`
7. **Sci-fi Primitives**: `<CornerEdges>` for custom container framing, Background canvas components (`CanvasBackground`, `ConstellationsBackground`, `PerlinNoiseBackground`, `AtmosphericAuroraBackground`)

---

## 2. Global Naming Conventions

- All components are **PascalCase** named exports from `@boredkevin/ui`.
- Props are **camelCase**: `chamfer`, `liquidGlass`, `cornerLines`, `telemetry`, `asChild`, `particleCount`.
- Button variants are: `"default"`, `"cyber"`, `"outline"`, `"secondary"`, `"destructive"`, `"ghost"`, `"link"`, `"white"`.
- Badge variants are: `"default"`, `"secondary"`, `"destructive"`, `"outline"`, `"success"`, `"warning"`.
- CSS custom properties are **kebab-case with `--` prefix**: `--primary`, `--chamfer-size`, `--glass-blur`.
- Tailwind classes always reference tokens: `bg-primary`, `text-muted-foreground`, `border-border`. Never use raw hex or HSL values.

---

## 3. Composition Rules

### Every Page
```tsx
<ThemeProvider>
  <div className="relative min-h-screen bg-background text-foreground">
    <CanvasBackground />   {/* optional theme-matched animated bg */}
    <div className="relative z-10 p-6">
      {/* page content */}
    </div>
  </div>
</ThemeProvider>
```

### Dashboard Page Pattern
```tsx
<ThemeProvider>
  <div className="min-h-screen bg-background text-foreground flex">
    {/* Sidebar */}
    <aside className="w-64 border-r border-border liquid-glass-panel p-4 flex flex-col gap-2">
      {/* nav items */}
    </aside>
    {/* Main */}
    <main className="flex-1 p-6 space-y-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card telemetry="SYS.01">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="success">ACTIVE</Badge>
              <span className="font-mono text-xs text-muted-foreground">99.9%</span>
            </div>
            <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Node Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Optimal</div>
          </CardContent>
        </Card>
      </div>
      {/* Data Table */}
      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent><Table>{/* table content */}</Table></CardContent>
      </Card>
    </main>
  </div>
</ThemeProvider>
```

### Form Pattern
```tsx
<Card className="max-w-md">
  <CardHeader>
    <CardTitle>Configure Node</CardTitle>
    <CardDescription>Update system parameters below.</CardDescription>
  </CardHeader>
  <CardContent>
    <form className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">Name</label>
        <Input id="name" placeholder="node-alpha-01" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <Input id="email" type="email" placeholder="ops@system.io" />
      </div>
    </form>
  </CardContent>
  <CardFooter className="gap-2">
    <Button variant="cyber" className="w-full">Save Configuration</Button>
    <Button variant="outline" className="w-full">Cancel</Button>
  </CardFooter>
</Card>
```

### Dialog Pattern
```tsx
import {
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
    <Button variant="outline">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogDescription>This action cannot be undone.</DialogDescription>
    </DialogHeader>
    {/* dialog body */}
    <DialogFooter className="gap-2">
      <Button variant="destructive">Confirm</Button>
      <Button variant="outline">Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 4. Accessibility Expectations

- All interactive components are built on **Radix UI** primitives — keyboard navigation and focus trapping are built in. Do not re-implement them.
- Icon-only `<Button>` elements **must** have an `aria-label`.
- `<Input>` elements **must** have an associated `<label>` with a matching `htmlFor` / `id` pair.
- `<Dialog>` includes `DialogTitle` and `DialogDescription` for screen readers.
- `<CornerEdges>` is `aria-hidden="true"` by default.
- Animated canvas backgrounds are decorative and placed behind content (`z-0` behind `relative z-10`).

---

## 5. Sci-Fi Primitives — Rules

### Chamfers
- `chamfer` prop is available on `<Button>` and `<Input>`.
- Default `chamfer="auto"` inherits from the active `ThemeConfig` — **use this unless overriding for a specific design reason**.
- Explicit values are: `"dual"` (top-right + bottom-left 45° cut), `"top-right"`, `"bottom-right"` (same clip as top-right), `"all"`, `"none"`.

### Corner Edges
- `<Card>` renders `<CornerEdges>` automatically when `cornerLines={true}` (default).
- Use standalone `<CornerEdges>` to add HUD bracket accents to any arbitrary `relative`-positioned container:
```tsx
<div className="relative p-4 border border-border bg-card">
  <CornerEdges size={10} glow={true} telemetry="HUD.A1" />
  {/* content */}
</div>
```

### Backgrounds
- Use `<CanvasBackground />` to match active theme settings automatically.
- Use `<ConstellationsBackground particleCount={80} maxDistance={140} speed={0.7} interactive={true} />` for star webbing.
- Use `<PerlinNoiseBackground particleCount={400} noiseScale={0.003} flowSpeed={0.8} colorMode="theme" interactive={true} />` for flow-field streamlines.
- Use `<AtmosphericAuroraBackground opacity={0.25} blur={130} />` for fluid ambient color orbs.
- Background components **must be positioned as siblings** to content inside a `relative` parent:
```tsx
<div className="relative min-h-screen">
  <CanvasBackground />
  <div className="relative z-10">{/* content */}</div>
</div>
```

### Liquid Glass
- The `liquid-glass-card` CSS class is applied automatically by `<Card liquidGlass={true}>`.
- For custom panels (sidebars, topbars), use `className="liquid-glass-panel"` directly.
- Never hard-code the `backdrop-filter` property — use `.liquid-glass-*` utility classes.

---

## 6. Anti-Patterns (Things AI Must NEVER Do)

| ❌ Wrong | ✅ Correct |
|---|---|
| `<button className="bg-primary …">` | `<Button variant="default">` |
| `<input className="border …">` | `<Input>` |
| `<div className="fixed inset-0 …">` (custom modal) | `<Dialog>` |
| `variant="primary"` on Button | `variant="default"` or `variant="cyber"` |
| `<Badge variant="cyber">` (does not exist) | `<Badge variant="outline">` or `<Badge variant="success">` |
| `<AuroraBackground>` (wrong export name) | `<AtmosphericAuroraBackground>` |
| `<CornerEdges variant="cyber">` (prop does not exist) | `<CornerEdges glow color="border-primary" />` |
| `className="text-cyan-400"` (hard-coded) | `className="text-primary"` |
| `className="bg-zinc-900"` (hard-coded) | `className="bg-background"` or `className="bg-card"` |
| Custom `CyberButton` component | `<Button variant="cyber">` |
| Hard-coded `border-radius: 4px` | `rounded-[var(--radius)]` |
| Skipping `<ThemeProvider>` | Always wrap app in `<ThemeProvider>` |
| `<a>` inside `<Button>` without `asChild` | `<Button asChild><a href="…">…</a></Button>` |

---

## 7. If a Needed Pattern is Missing

If the user asks for UI that `@boredkevin/ui` does not have a component for:
1. Compose from existing primitives first.
2. Use Tailwind with **semantic token classes** only (`bg-card`, `text-muted-foreground`, `border-border`).
3. Note: "No `<Select>` exists in the library — using styled `<select>` with semantic token classes for now."
4. Do NOT invent fictional component names.
