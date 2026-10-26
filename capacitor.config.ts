import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sam3lds.catsvsdogs',
  // appId is kept from v1 so the App Store update path (and saved progress) carries over. See docs/DECISIONS.md D9.
  appName: 'Pawtopia',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#FBF8F1',
  },
};

export default config;
