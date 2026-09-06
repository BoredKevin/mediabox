import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const EXPORTS_FILE = path.resolve('packages/ui/src/index.ts');
const META_DIR = path.resolve('ai-skill/components');

async function validateMeta() {
  console.log('🔍 Validating @boredkevin/ui AI Skill Component Metadata...\n');

  if (!fs.existsSync(EXPORTS_FILE)) {
    console.error(`❌ Exports file not found at: ${EXPORTS_FILE}`);
    process.exit(1);
  }

  // 1. Parse exported component module paths from packages/ui/src/index.ts
  const indexContent = fs.readFileSync(EXPORTS_FILE, 'utf8');
  const exportMatches = [
    ...indexContent.matchAll(/export \* from '\.\/components\/ui\/([^']+)'/g),
  ];
  const expectedModules = exportMatches.map((m) => m[1]);

  console.log(`Found ${expectedModules.length} component modules in index.ts:`);
  console.log(expectedModules.map((m) => `  - ${m}`).join('\n'));
  console.log('');

  // 2. Verify meta files exist for all expected modules
  const missingMeta: string[] = [];
  for (const mod of expectedModules) {
    const metaPath = path.join(META_DIR, `${mod}.meta.ts`);
    if (!fs.existsSync(metaPath)) {
      missingMeta.push(mod);
    }
  }

  if (missingMeta.length > 0) {
    console.error(`❌ Missing meta files for modules: ${missingMeta.join(', ')}`);
    process.exit(1);
  }

  // 3. Dynamically import and validate each meta file
  const metaFiles = fs
    .readdirSync(META_DIR)
    .filter((f) => f.endsWith('.meta.ts'));

  const errors: string[] = [];
  let validCount = 0;

  for (const file of metaFiles) {
    const fullPath = path.join(META_DIR, file);
    const fileUrl = pathToFileURL(fullPath).href;

    try {
      const module = await import(fileUrl);
      const meta = module.default || Object.values(module)[0];

      if (!meta) {
        errors.push(`${file}: No default or exported ComponentMeta found.`);
        continue;
      }

      // Validate required fields
      const requiredFields = [
        'name',
        'exports',
        'importPath',
        'description',
        'whenToUse',
        'whenNotToUse',
        'antiPatterns',
        'props',
        'aiHints',
        'examples',
      ];

      for (const field of requiredFields) {
        if (!(field in meta)) {
          errors.push(`${file}: Missing required field '${field}'`);
        }
      }

      if (Array.isArray(meta.exports) && meta.exports.length === 0) {
        errors.push(`${file}: 'exports' array must not be empty.`);
      }

      if (Array.isArray(meta.whenToUse) && meta.whenToUse.length === 0) {
        errors.push(`${file}: 'whenToUse' array must not be empty.`);
      }

      if (Array.isArray(meta.props) && meta.props.length === 0) {
        errors.push(`${file}: 'props' array must not be empty.`);
      }

      if (Array.isArray(meta.aiHints) && meta.aiHints.length === 0) {
        errors.push(`${file}: 'aiHints' array must not be empty.`);
      }

      if (Array.isArray(meta.examples) && meta.examples.length === 0) {
        errors.push(`${file}: 'examples' array must contain at least 1 code snippet.`);
      }

      validCount++;
    } catch (err: any) {
      errors.push(`${file}: Failed to import module: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('❌ Metadata validation failed with errors:');
    console.error(errors.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(`✅ All ${validCount} component meta files passed validation with zero errors!`);
}

validateMeta().catch((err) => {
  console.error('Fatal error during validation:', err);
  process.exit(1);
});
