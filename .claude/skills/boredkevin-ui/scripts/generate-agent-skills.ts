import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { ComponentMeta } from '../schema/types';

const META_DIR = path.resolve('ai-skill/components');
const AGENTS_SKILLS_DIR = path.resolve('.agents/skills');
const ROOT_SKILLS_DIR = path.resolve('skills');
const PACKAGES_UI_SKILLS_DIR = path.resolve('packages/ui/skills');
const SKILLS_MANIFEST_PATH = path.resolve('skills.json');

async function loadAllMeta(): Promise<Array<{ slug: string; meta: ComponentMeta }>> {
  const metaFiles = fs
    .readdirSync(META_DIR)
    .filter((f) => f.endsWith('.meta.ts') && f !== 'index.ts');

  const components: Array<{ slug: string; meta: ComponentMeta }> = [];

  for (const file of metaFiles) {
    const slug = file.replace('.meta.ts', '');
    const fullPath = path.join(META_DIR, file);
    const fileUrl = pathToFileURL(fullPath).href;
    const module = await import(fileUrl);
    const meta: ComponentMeta = module.default || Object.values(module)[0];
    if (meta && meta.name) {
      components.push({ slug, meta });
    }
  }

  // Sort alphabetically by slug
  components.sort((a, b) => a.slug.localeCompare(b.slug));
  return components;
}

function generateMasterSkill(components: Array<{ slug: string; meta: ComponentMeta }>): string {
  const componentIndex = components
    .map(({ slug, meta }) => {
      const exportsStr = meta.exports.join(', ');
      return `- **[\`boredkevin-ui-${slug}\`](.agents/skills/boredkevin-ui-${slug}/SKILL.md)**: ${meta.name} (${exportsStr}) — ${meta.description}`;
    })
    .join('\n');

  return `---
name: boredkevin-ui
description: >
  Master guide for @boredkevin/ui — a precision-crafted, pitch-dark React design system built
  on Radix UI and Tailwind CSS v3 with sci-fi HUD tokens, corner chamfers, and animated backgrounds.
---

# @boredkevin/ui — Master Agent Skill

Welcome to **@boredkevin/ui**. This skill teaches AI coding assistants (Antigravity, Cursor, Claude Code, Copilot, Windsurf) how to properly use and compose components from the library.

The library follows a strict **sci-fi / pitch-dark HUD aesthetic**. It is NOT a generic SaaS UI library.
Aesthetic hallmarks: pitch-dark canvas backgrounds, 45° chamfered clip-path corners, neon primary glow states, liquid-glass frosted cards, telemetry brackets, and hardware-accelerated animated canvas backgrounds.

---

## 0. Mandatory Setup Checklist (Every Project)

Before generating UI component code, verify:
1. **Dependencies installed**: \`npm install @boredkevin/ui lucide-react\`
2. **CSS Tokens imported**: \`import '@boredkevin/ui/theme.css';\` at root (e.g. \`App.tsx\` or \`layout.tsx\`)
3. **App Tree wrapped**: Wrap the root tree in \`<ThemeProvider>\`
4. **Tailwind Config updated**: Include \`'./node_modules/@boredkevin/ui/**/*.{js,mjs,ts,tsx}'\` in \`content\` of \`tailwind.config.js\`

\`\`\`tsx
// App.tsx minimal correct setup
import React from 'react';
import { ThemeProvider } from '@boredkevin/ui';
import '@boredkevin/ui/theme.css';

export default function App() {
  return (
    <ThemeProvider>
      {/* application tree */}
    </ThemeProvider>
  );
}
\`\`\`

---

## 1. Modular Component Sub-Skills Directory

Each component in @boredkevin/ui has a dedicated skill folder with exact prop types, valid variants, and code snippets.
When working with a specific component, refer to its sub-skill:

${componentIndex}

---

## 2. Core Sci-Fi Tokens & Rules

### Color Tokens (Never Hardcode Colors)
Never output raw hex (\`#00f0ff\`) or raw HSL values in class names. Always use semantic Tailwind token classes:
- Backgrounds: \`bg-background\`, \`bg-card\`, \`bg-popover\`, \`bg-muted\`
- Foregrounds: \`text-foreground\`, \`text-card-foreground\`, \`text-muted-foreground\`
- Accents: \`bg-primary\`, \`text-primary\`, \`border-primary\`, \`border-border\`
- Status: \`text-destructive\`, \`bg-destructive\`

### Chamfers (Clip-path Corners)
- Available on \`<Button>\` and \`<Input>\` via the \`chamfer\` prop.
- Default is \`chamfer="auto"\` (inherits from current theme preset).
- Explicit values: \`"dual"\` (top-right & bottom-left cut), \`"top-right"\`, \`"all"\`, \`"none"\`.

### Corner Edges & Telemetry
- \`<Card>\` features telemetry text (\`telemetry="SYS.01"\`), corner lines (\`cornerLines={true}\`), and frosted glass (\`liquidGlass={true}\`).
- Standalone \`<CornerEdges size={10} glow={true} telemetry="HUD.01" />\` can frame any arbitrary container with HUD brackets.

### Canvas Backgrounds
Position ambient canvas backgrounds behind content inside a \`relative\` container:
- \`<CanvasBackground />\`: Auto-matches active theme.
- \`<ConstellationsBackground particleCount={80} maxDistance={140} speed={0.7} interactive={true} />\`
- \`<PerlinNoiseBackground particleCount={400} noiseScale={0.003} flowSpeed={0.8} colorMode="theme" interactive={true} />\`
- \`<AtmosphericAuroraBackground opacity={0.25} blur={130} />\`

---

## 3. Global Anti-Patterns

| ❌ Wrong | ✅ Correct |
|---|---|
| \`<button className="bg-cyan-500 ...">\` | \`<Button variant="cyber">\` or \`<Button variant="default">\` |
| \`<input className="border ...">\` | \`<Input chamfer="auto" />\` |
| \`<div className="fixed inset-0 ...">\` (custom modal) | \`<Dialog>\` |
| \`variant="primary"\` on Button | \`variant="default"\` or \`variant="cyber"\` |
| \`<Badge variant="cyber">\` | \`<Badge variant="outline">\` or \`<Badge variant="success">\` |
| Hard-coded colors (\`text-cyan-400\`, \`bg-black\`) | Semantic classes (\`text-primary\`, \`bg-background\`) |
| Skipping \`<ThemeProvider>\` | Always wrap root with \`<ThemeProvider>\` |
| \`<a>\` inside \`<Button>\` without \`asChild\` | \`<Button asChild><a href="...">Link</a></Button>\` |

---

## 4. Page Composition Patterns

### Full Page HUD Shell
\`\`\`tsx
import React from 'react';
import { ThemeProvider, CanvasBackground, Card, CardHeader, CardTitle, CardContent, Button } from '@boredkevin/ui';
import '@boredkevin/ui/theme.css';

export function HudPage() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <CanvasBackground />
        <Card telemetry="SYS.01" cornerLines={true} liquidGlass={true} className="w-full max-w-md relative z-10">
          <CardHeader>
            <CardTitle>TELEMETRY INTERFACE</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">All systems operational.</p>
            <Button variant="cyber" className="w-full">ENGAGE</Button>
          </CardContent>
        </Card>
      </div>
    </ThemeProvider>
  );
}
\`\`\`
`;
}

function generateComponentSkill(slug: string, meta: ComponentMeta): string {
  const exportsList = meta.exports.join(', ');
  const whenToUseList = meta.whenToUse.map((item) => `- ${item}`).join('\n');
  const whenNotToUseList = meta.whenNotToUse.map((item) => `- ${item}`).join('\n');
  const antiPatternsList = meta.antiPatterns.map((item) => `- ❌ ${item}`).join('\n');
  const aiHintsList = meta.aiHints.map((item) => `- 💡 ${item}`).join('\n');

  let propsTable = '';
  if (meta.props && meta.props.length > 0) {
    const rows = meta.props
      .map(
        (p) =>
          `| \`${p.name}\` | \`${p.type.replace(/\|/g, '\\|')}\` | ${p.defaultValue ? `\`${p.defaultValue}\`` : '—'} | ${p.description} |`
      )
      .join('\n');
    propsTable = `| Prop | Type | Default | Description |
|---|---|---|---|
${rows}`;
  } else {
    propsTable = 'Standard HTML/React props supported.';
  }

  let variantsSection = '';
  if (meta.variants && meta.variants.length > 0) {
    const rows = meta.variants
      .map(
        (v) =>
          `| \`${v.name}\` | ${v.description} | ${v.whenToUse} |`
      )
      .join('\n');
    variantsSection = `### Supported Variants
| Variant | Description | When to Use |
|---|---|---|
${rows}
`;
  }

  let compositionSection = '';
  if (meta.composition) {
    const parts: string[] = [];
    if (meta.composition.required && meta.composition.required.length > 0) {
      parts.push(`- **Required Sub-components**: ${meta.composition.required.map((s) => `\`<${s}>\``).join(', ')}`);
    }
    if (meta.composition.optional && meta.composition.optional.length > 0) {
      parts.push(`- **Optional Sub-components**: ${meta.composition.optional.map((s) => `\`<${s}>\``).join(', ')}`);
    }
    if (meta.composition.rules && meta.composition.rules.length > 0) {
      parts.push(meta.composition.rules.map((r) => `- ${r}`).join('\n'));
    }
    compositionSection = `### Composition Rules
${parts.join('\n')}
`;
  }

  let tokensSection = '';
  if (meta.tokens && meta.tokens.length > 0) {
    const rows = meta.tokens
      .map(
        (t) =>
          `| \`${t.cssVar}\` | ${t.tailwindClass ? `\`${t.tailwindClass}\`` : '—'} | ${t.role} |`
      )
      .join('\n');
    tokensSection = `### Design Tokens & CSS Variables
| CSS Variable | Tailwind Class | Role |
|---|---|---|
${rows}
`;
  }

  const examplesSection = meta.examples
    .map(
      (eg) => `#### ${eg.label}
\`\`\`tsx
${eg.code.trim()}
\`\`\``
    )
    .join('\n\n');

  return `---
name: boredkevin-ui-${slug}
description: >
  Use when building, styling, or updating ${meta.name} (${exportsList}) with @boredkevin/ui.
  ${meta.description}
---

# ${meta.name} — @boredkevin/ui Component Skill

> ${meta.description}

- **Package Import**: \`import { ${exportsList} } from '${meta.importPath}';\`
${meta.radixPrimitive ? `- **Base Primitive**: \`${meta.radixPrimitive}\`` : ''}
- **Online Documentation**: [${meta.name} Documentation](${meta.docsUrl || `https://ui.bkev.in/docs/components/${slug}`})

---

## When to Reach for ${meta.name}
${whenToUseList}

## When NOT to Use ${meta.name}
${whenNotToUseList}

---

## Anti-Patterns
${antiPatternsList}

---

## Props Reference
${propsTable}

${variantsSection}
${compositionSection}
${tokensSection}
## AI Guidelines & Implementation Hints
${aiHintsList}

---

## Ready-to-Use Examples

${examplesSection}
`;
}

async function main() {
  console.log('🚀 Generating Convex-style modular LLM agent skills for @boredkevin/ui...\n');

  const components = await loadAllMeta();
  console.log(`Found ${components.length} component metadata modules.`);

  // 1. Ensure output directories exist
  const agentMasterDir = path.join(AGENTS_SKILLS_DIR, 'boredkevin-ui');
  fs.mkdirSync(agentMasterDir, { recursive: true });

  const rootMasterDir = path.join(ROOT_SKILLS_DIR, 'boredkevin-ui');
  fs.mkdirSync(rootMasterDir, { recursive: true });

  const pkgMasterDir = path.join(PACKAGES_UI_SKILLS_DIR, 'boredkevin-ui');
  fs.mkdirSync(pkgMasterDir, { recursive: true });

  // 2. Generate Master Skill
  const masterContent = generateMasterSkill(components);
  const masterAgentPath = path.join(agentMasterDir, 'SKILL.md');
  const masterRootPath = path.join(rootMasterDir, 'SKILL.md');
  const masterPkgPath = path.join(pkgMasterDir, 'SKILL.md');
  fs.writeFileSync(masterAgentPath, masterContent, 'utf8');
  fs.writeFileSync(masterRootPath, masterContent, 'utf8');
  fs.writeFileSync(masterPkgPath, masterContent, 'utf8');
  console.log(`✅ Generated master skill at:`);
  console.log(`   - ${masterAgentPath}`);
  console.log(`   - ${masterRootPath}`);
  console.log(`   - ${masterPkgPath}`);

  // 3. Generate Sub-Skills for each component
  const skillsManifestEntries = [
    {
      name: 'boredkevin-ui',
      description: 'Master skill for @boredkevin/ui design system, tokens, and component index',
      path: 'skills/boredkevin-ui/SKILL.md',
    },
  ];

  for (const { slug, meta } of components) {
    const skillName = `boredkevin-ui-${slug}`;
    const componentContent = generateComponentSkill(slug, meta);

    // Write to .agents/skills/boredkevin-ui-<slug>/SKILL.md
    const agentSkillDir = path.join(AGENTS_SKILLS_DIR, skillName);
    fs.mkdirSync(agentSkillDir, { recursive: true });
    const agentSkillFile = path.join(agentSkillDir, 'SKILL.md');
    fs.writeFileSync(agentSkillFile, componentContent, 'utf8');

    // Write to skills/boredkevin-ui-<slug>/SKILL.md (for open skills ecosystem / npx skills add)
    const rootSkillDir = path.join(ROOT_SKILLS_DIR, skillName);
    fs.mkdirSync(rootSkillDir, { recursive: true });
    const rootSkillFile = path.join(rootSkillDir, 'SKILL.md');
    fs.writeFileSync(rootSkillFile, componentContent, 'utf8');

    // Write to packages/ui/skills/boredkevin-ui-<slug>/SKILL.md (bundled with npm package)
    const pkgSkillDir = path.join(PACKAGES_UI_SKILLS_DIR, skillName);
    fs.mkdirSync(pkgSkillDir, { recursive: true });
    const pkgSkillFile = path.join(pkgSkillDir, 'SKILL.md');
    fs.writeFileSync(pkgSkillFile, componentContent, 'utf8');

    skillsManifestEntries.push({
      name: skillName,
      description: `Skill for ${meta.name} component (${meta.exports.join(', ')})`,
      path: `skills/${skillName}/SKILL.md`,
    });
  }

  console.log(`✅ Generated ${components.length} component sub-skills in .agents/skills/, skills/, and packages/ui/skills/`);

  // 4. Generate skills.json manifest
  const pkgJsonPath = path.resolve('packages/ui/package.json');
  const pkgVersion = fs.existsSync(pkgJsonPath)
    ? JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version
    : '1.0.0';

  const manifest = {
    $schema: 'https://skills.json',
    name: '@boredkevin/ui',
    version: pkgVersion,
    description: 'Convex-style modular AI Agent Skills for @boredkevin/ui React sci-fi component library',
    homepage: 'https://ui.bkev.in/docs/llms',
    repository: 'https://github.com/BoredKevin/ui',
    skills: skillsManifestEntries,
  };

  fs.writeFileSync(SKILLS_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`✅ Generated registry manifest: ${SKILLS_MANIFEST_PATH}`);

  console.log('\n✨ All agent skills generated successfully!');
}

main().catch((err) => {
  console.error('❌ Failed to generate agent skills:', err);
  process.exit(1);
});
