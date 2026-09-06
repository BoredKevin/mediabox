# @boredkevin/ui — AI Agent Skills & LLM System

Teach your AI coding assistants (Antigravity, Cursor, Claude Code, GitHub Copilot, Windsurf, or ChatGPT) how to write pixel-perfect, on-brand React code with `@boredkevin/ui`.

Following the modular agent skills architecture popularized by Convex (`get-convex/agent-skills`), `@boredkevin/ui` provides:
- **Master Skill**: `.agents/skills/boredkevin-ui/SKILL.md` (overview, setup, ThemeProvider, design tokens, HUD primitives).
- **17 Granular Component Sub-Skills**: `.agents/skills/boredkevin-ui-<component>/SKILL.md` for every component.
- **Layered Rules**: Adds on top of your existing `.cursorrules`, `AGENTS.md`, and `CLAUDE.md` without overwriting your custom rules.

---

## Quick Install Methods

### Method 1: Automatic Setup via @boredkevin/ui CLI (Recommended)

Run this one-liner in your project root to layer rules and install all skills:

```bash
# Initialize master skill, component skills, and layer rules on top of existing files
npx @boredkevin/ui init

# Or install specific component sub-skills
npx @boredkevin/ui add button card dialog
```

### Method 2: Universal Skills CLI (Convex Compatible)

```bash
# Install all skills
npx skills add BoredKevin/ui --all

# Or install a specific skill
npx skills add BoredKevin/ui --skill boredkevin-ui-button
```

---

## 🛡️ Non-Destructive Layering ("Added On Top")

When `@boredkevin/ui init` runs, it checks for existing configuration files:
- `.cursorrules`
- `AGENTS.md`
- `CLAUDE.md`

Rules are injected using delimiter markers:
```markdown
<!-- @boredkevin/ui:start -->
# @boredkevin/ui Rules
...
<!-- @boredkevin/ui:end -->
```

- **If the file already exists**: The `@boredkevin/ui` rules are prepended on top, preserving all of your project's custom instructions, formatting conventions, and existing rules.
- **If the file is updated later**: Running `init` again cleanly updates the block between the markers without duplicating content or altering your custom rules.

---

## 📦 Installed Skill Directory

```text
your-project/
├── .cursorrules                      # Layered on top
├── AGENTS.md                         # Layered on top
├── CLAUDE.md                         # Layered on top
└── .agents/
    └── skills/
        ├── boredkevin-ui/
        │   └── SKILL.md              # Master Skill
        ├── boredkevin-ui-accordion/
        │   └── SKILL.md
        ├── boredkevin-ui-avatar/
        │   └── SKILL.md
        ├── boredkevin-ui-backgrounds/
        │   └── SKILL.md
        ├── boredkevin-ui-badge/
        │   └── SKILL.md
        ├── boredkevin-ui-button/
        │   └── SKILL.md
        ├── boredkevin-ui-calendar/
        │   └── SKILL.md
        ├── boredkevin-ui-card/
        │   └── SKILL.md
        ├── boredkevin-ui-corner-edges/
        │   └── SKILL.md
        ├── boredkevin-ui-dialog/
        │   └── SKILL.md
        ├── boredkevin-ui-dropdown-menu/
        │   └── SKILL.md
        ├── boredkevin-ui-input/
        │   └── SKILL.md
        ├── boredkevin-ui-separator/
        │   └── SKILL.md
        ├── boredkevin-ui-slider/
        │   └── SKILL.md
        ├── boredkevin-ui-switch/
        │   └── SKILL.md
        ├── boredkevin-ui-table/
        │   └── SKILL.md
        ├── boredkevin-ui-tabs/
        │   └── SKILL.md
        └── boredkevin-ui-tooltip/
            └── SKILL.md
```

---

## 🛠️ Editor & Assistant-Specific Setup

### 1. Cursor IDE
Runs with `.cursorrules` in project root. If you want skills mirrored to `.cursor/skills/`:
```bash
npx @boredkevin/ui init --cursor
```

### 2. Claude Code
Reads `CLAUDE.md` in project root. If you want skills mirrored to `.claude/skills/`:
```bash
npx @boredkevin/ui init --claude
```

### 3. Antigravity IDE & AI Agents
Antigravity automatically discovers skills in `.agents/skills/`. You can also install globally:
```bash
# Windows
mkdir "%USERPROFILE%\.gemini\config\skills\boredkevin-ui"
curl -fsSL https://ui.bkev.in/skills/boredkevin-ui/SKILL.md -o "%USERPROFILE%\.gemini\config\skills\boredkevin-ui\SKILL.md"

# macOS / Linux
mkdir -p ~/.gemini/config/skills/boredkevin-ui
curl -fsSL https://ui.bkev.in/skills/boredkevin-ui/SKILL.md -o ~/.gemini/config/skills/boredkevin-ui/SKILL.md
```

### 4. GitHub Copilot
Use `.github/copilot-instructions.md` with:
```markdown
<!-- @boredkevin/ui:start -->
- Use @boredkevin/ui components for all UI development.
- Always include <ThemeProvider> at the root of React component trees.
- Use chamfer="auto" on <Button> and <Input>.
- Use <Card telemetry="SYS.01"> with CardHeader, CardTitle, CardDescription, CardContent, and CardFooter.
- Consult .agents/skills/boredkevin-ui/SKILL.md for complete details.
<!-- @boredkevin/ui:end -->
```

---

## 🌐 Endpoints & Specifications

- **Live Documentation**: `https://ui.bkev.in/docs`
- **Standardized LLMs Index**: `https://ui.bkev.in/llms.txt`
- **Skills Registry Manifest**: `https://ui.bkev.in/skills.json`
- **Master AI Skill**: `https://ui.bkev.in/skills/boredkevin-ui/SKILL.md`
- **Design Tokens Schema**: `https://ui.bkev.in/ai-skill/design.json`
