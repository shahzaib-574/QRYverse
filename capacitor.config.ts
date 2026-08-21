import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.royal.qrystudio',
  appName: 'QRY',
  webDir: 'dist',
  backgroundColor: '#f4f7f2',
  loggingBehavior: 'none',
  server: { androidScheme: 'https' },
  android: {
    allowMixedContent: false,
    backgroundColor: '#f4f7f2',
  },
};

export default config;
