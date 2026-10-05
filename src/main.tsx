import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAutoSync } from './platform/lanSync';
import './index.css';

async function boot(): Promise<void> {
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isNative) {
    try {
      const { installAndroidApi } = await import('./platform/androidApi');
      installAndroidApi();
    } catch (e) {
      console.error('Failed to install Android bridge:', e);
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  initAutoSync();
}

void boot();
