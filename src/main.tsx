import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClientProvider} from '@tanstack/react-query';
import App from './App.tsx';
import AppErrorBoundary from './components/AppErrorBoundary';
import './index.css';
import {queryClient} from './lib/queryClient';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);

// Register the service worker for PWA installability (Chrome requires an active
// SW with a fetch handler before it will fire beforeinstallprompt).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // Ensure a controlling worker as soon as possible (helps installability).
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        void reg.update();
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}
