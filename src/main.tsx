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

// Register the service worker for PWA install + offline support (and the
// foundation for future Web Push notifications).
// Cache-bust query ensures browsers pick up sw.js changes (Supabase bypass).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=2').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
