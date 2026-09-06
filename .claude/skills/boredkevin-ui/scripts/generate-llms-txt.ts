import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://ui.bkev.in';
const PUBLIC_DIR = path.resolve('public');
const SHOWCASE_PUBLIC_DIR = path.resolve('apps/showcase/public');
const META_DIR = path.resolve('ai-skill/components');

async function generateLlmsTxt() {
  console.log('📝 Generating public/llms.txt index...');

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHOWCASE_PUBLIC_DIR)) {
    fs.mkdirSync(SHOWCASE_PUBLIC_DIR, { recursive: true });
  }

  const metaFiles = fs
    .readdirSync(META_DIR)
    .filter((f) => f.endsWith('.meta.ts'));

  const lines: string[] = [
    '# @boredkevin/ui',
    '',
    '> A precision-crafted, pitch-dark React design system with live HSL theme controls, custom sci-fi chamfers, and hardware-accelerated canvas backgrounds.',
    '',
    '## Documentation & Endpoints',
    `- Quickstart & Setup: ${BASE_URL}/docs/installation`,
    `- Theming & Tokens: ${BASE_URL}/docs/theming`,
    `- Canvas Backgrounds: ${BASE_URL}/docs/backgrounds`,
    `- LLMs Prompt Guide: ${BASE_URL}/docs/llms`,
    '',
    '## AI Skills & Machine Specifications',
    '- CLI Setup: `npx @boredkevin/ui init` (or `npx skills add BoredKevin/ui`)',
    `- Master System Skill: ${BASE_URL}/skills/boredkevin-ui/SKILL.md`,
    `- Skills Manifest: ${BASE_URL}/skills.json`,
    `- Design Tokens & Brand Schema: ${BASE_URL}/ai-skill/design.json`,
    '',
    '## Modular Component AI Skills & Docs',
  ];

  for (const file of metaFiles) {
    const slug = file.replace('.meta.ts', '');
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    lines.push(
      `- **${name}**: ${BASE_URL}/docs/components/${slug} (Skill: ${BASE_URL}/skills/boredkevin-ui-${slug}/SKILL.md)`
    );
  }

  lines.push(
    '',
    '## Quick Installation & Setup',
    '```bash',
    'npm install @boredkevin/ui lucide-react',
    '```',
    '',
    'Import CSS tokens and wrap your root with `ThemeProvider`:',
    '```tsx',
    "import React from 'react';",
    "import { ThemeProvider, Card, CardHeader, CardTitle, CardContent, Button, CanvasBackground } from '@boredkevin/ui';",
    "import '@boredkevin/ui/theme.css';",
    '',
    'export function App() {',
    '  return (',
    '    <ThemeProvider>',
    '      <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-6">',
    '        <CanvasBackground />',
    '        <Card telemetry="SYS.01" className="w-full max-w-md relative z-10">',
    '          <CardHeader>',
    '            <CardTitle>Telemetry Node</CardTitle>',
    '          </CardHeader>',
    '          <CardContent>',
    '            <Button variant="cyber" className="w-full">Initialize</Button>',
    '          </CardContent>',
    '        </Card>',
    '      </div>',
    '    </ThemeProvider>',
    '  );',
    '}',
    '```',
    ''
  );

  const outputPath = path.join(PUBLIC_DIR, 'llms.txt');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  const showcaseOutputPath = path.join(SHOWCASE_PUBLIC_DIR, 'llms.txt');
  fs.writeFileSync(showcaseOutputPath, lines.join('\n'), 'utf8');
  console.log(`✅ Saved ${lines.length} lines to ${outputPath} and ${showcaseOutputPath}`);
}

generateLlmsTxt().catch((err) => {
  console.error('Failed to generate llms.txt:', err);
  process.exit(1);
});
