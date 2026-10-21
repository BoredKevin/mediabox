import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

const getCommitHash = () => {
  if (process.env.CF_PAGES_COMMIT_SHA) {
    return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  }
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  if (process.env.VITE_COMMIT_HASH) {
    return process.env.VITE_COMMIT_HASH.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return '129900f';
  }
};

const commitHash = getCommitHash();

// Fallback to active production Turnstile sitekey if Cloudflare Pages build environment variable is omitted
const PRODUCTION_TURNSTILE_SITE_KEY = '0x4AAAAAAFZcBY46Tlp-sHr7';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const turnstileSiteKey =
    process.env.VITE_TURNSTILE_SITE_KEY ||
    env.VITE_TURNSTILE_SITE_KEY ||
    PRODUCTION_TURNSTILE_SITE_KEY;

  return {
    plugins: [react()],
    define: {
      __COMMIT_HASH__: JSON.stringify(commitHash),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(turnstileSiteKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['winware.ts.bkev.in'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-qr': ['qrcode.react'],
            'vendor-youtubei': ['youtubei.js'],
          },
        },
      },
    },
  };
});
