import { execSync } from 'child_process';

const hasDeployKey = Boolean(process.env.CONVEX_DEPLOY_KEY);
const isInsideConvexDeploy =
  process.env.CONVEX_DEPLOY_IN_PROGRESS === 'true' ||
  (hasDeployKey && Boolean(process.env.VITE_CONVEX_URL));
const isCloudflarePages = Boolean(process.env.CF_PAGES);

function runCommand(command, extraEnv = {}) {
  try {
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
  } catch (err) {
    process.exit(err.status ?? 1);
  }
}

if (hasDeployKey && !isInsideConvexDeploy) {
  console.log('[build] CONVEX_DEPLOY_KEY detected. Deploying Convex backend and building frontend...');
  runCommand('npx convex deploy --cmd "npm run build:frontend"', {
    CONVEX_DEPLOY_IN_PROGRESS: 'true',
  });
} else {
  if (isCloudflarePages && !hasDeployKey && !isInsideConvexDeploy) {
    console.warn(
      '\n[build] WARNING: Running in Cloudflare Pages (CF_PAGES=1), but CONVEX_DEPLOY_KEY is not set.'
    );
    console.warn(
      '[build] To deploy Convex backend functions and inject the production URL during build,'
    );
    console.warn(
      '[build] set CONVEX_DEPLOY_KEY in Cloudflare Pages: Settings > Environment variables.\n'
    );
  }

  console.log('[build] Building frontend...');
  runCommand('npm run build:frontend');
}
