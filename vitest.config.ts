import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import vite from './vite.config';

// Security-rules tests need the Firestore emulator, so they only run through `npm run fb:test`.
export default mergeConfig(
  vite,
  defineConfig({
    test: {
      exclude: [...configDefaults.exclude, 'functions/**', ...(process.env.FIREBASE_RULES_TEST ? [] : ['test/firebase/**'])],
    },
  }),
);
