// Bundles functions/src/index.ts (and the shared leaderboard logic it imports from src/) into functions/lib/index.js.
//   npm run fb:build
import { build } from 'esbuild';

await build({
  entryPoints: ['functions/src/index.ts'],
  outfile: 'functions/lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions'],
  logLevel: 'info',
});
