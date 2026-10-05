import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.taskreminder.app',
  appName: 'Task Reminder',
  webDir: 'dist',
  server: {
    // Must stay 'http': with the default 'https' origin, WebView blocks
    // fetch() to the plain-HTTP LAN sync server as mixed content.
    androidScheme: 'http',
  },
};

export default config;
