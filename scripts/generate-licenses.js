import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootPkgPath = path.join(rootDir, 'package.json');
const rootLockPath = path.join(rootDir, 'package-lock.json');
const rootLicensePath = path.join(rootDir, 'LICENSE');
const outDir = path.join(rootDir, 'src', 'data');
const outFile = path.join(outDir, 'licenses.json');

const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const lock = JSON.parse(fs.readFileSync(rootLockPath, 'utf8'));
const directDeps = new Set(Object.keys(rootPkg.dependencies || {}));

const rootLicenseText = fs.existsSync(rootLicensePath)
  ? fs.readFileSync(rootLicensePath, 'utf8').trim()
  : '';

function normalizeRepoUrl(repo) {
  if (!repo) return '';
  if (typeof repo === 'object' && repo.url) repo = repo.url;
  if (typeof repo !== 'string') return '';
  let url = repo.trim();
  if (url.startsWith('git+')) url = url.slice(4);
  if (url.endsWith('.git')) url = url.slice(0, -4);
  if (url.startsWith('git://')) url = 'https://' + url.slice(6);
  if (url.startsWith('github:')) url = 'https://github.com/' + url.slice(7);
  if (!url.startsWith('http') && url.includes('/')) {
    url = 'https://github.com/' + url;
  }
  return url;
}

const packagesMap = new Map();

// Root package (mediabox)
packagesMap.set('mediabox', {
  name: 'mediabox',
  version: rootPkg.version || '1.0.0',
  license: rootPkg.license || 'CPAL-1.0',
  repository: normalizeRepoUrl(rootPkg.repository) || 'https://github.com/boredkevin/mediabox',
  publisher: typeof rootPkg.author === 'string' ? rootPkg.author : rootPkg.author?.name || 'BoredKevin',
  description: 'Retro sci-fi themed YouTube watch party application',
  isDirect: true,
  isRoot: true,
  licenseText: rootLicenseText,
});

if (lock.packages) {
  for (const [pkgPath, info] of Object.entries(lock.packages)) {
    if (!pkgPath.startsWith('node_modules/')) continue;
    if (info.dev) continue; // Production only

    const parts = pkgPath.split('node_modules/');
    const pkgName = parts[parts.length - 1];
    if (!pkgName || packagesMap.has(pkgName)) continue;

    const diskPath = path.join(rootDir, pkgPath);
    let licenseText = '';
    let pkgJson = info;

    if (fs.existsSync(diskPath)) {
      try {
        const files = fs.readdirSync(diskPath);
        const licFile = files.find(f => /^licen[cs]e/i.test(f) || /^copying/i.test(f));
        if (licFile) {
          const rawText = fs.readFileSync(path.join(diskPath, licFile), 'utf8');
          if (licFile.toLowerCase().startsWith('readme')) {
            const match = rawText.match(/(?:##|###)\s*license[\s\S]*/i);
            licenseText = match ? match[0].slice(0, 3000).trim() : rawText.slice(0, 1500).trim();
          } else {
            licenseText = rawText.trim();
          }
        }

        const pJsonPath = path.join(diskPath, 'package.json');
        if (fs.existsSync(pJsonPath)) {
          pkgJson = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
        }
      } catch (err) {
        // Fallback to lock info
      }
    }

    const licenseId = pkgJson.license ||
      (pkgJson.licenses && (pkgJson.licenses[0]?.type || pkgJson.licenses[0])) ||
      info.license ||
      'Unknown';

    const author = typeof pkgJson.author === 'string'
      ? pkgJson.author
      : pkgJson.author?.name || '';

    packagesMap.set(pkgName, {
      name: pkgName,
      version: pkgJson.version || info.version || '',
      license: typeof licenseId === 'string' ? licenseId : JSON.stringify(licenseId),
      repository: normalizeRepoUrl(pkgJson.repository || pkgJson.homepage || info.homepage),
      publisher: author,
      description: pkgJson.description || '',
      isDirect: directDeps.has(pkgName),
      isRoot: false,
      licenseText: licenseText.slice(0, 5000),
    });
  }
}

const list = Array.from(packagesMap.values());

// Sort: mediabox first, then direct dependencies alphabetically, then other dependencies alphabetically
list.sort((a, b) => {
  if (a.isRoot) return -1;
  if (b.isRoot) return 1;
  if (a.isDirect !== b.isDirect) return a.isDirect ? -1 : 1;
  return a.name.localeCompare(b.name);
});

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outFile, JSON.stringify(list, null, 2), 'utf8');
console.log(`Generated ${list.length} licenses in ${outFile}`);
