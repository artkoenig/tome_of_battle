import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { DebugProvider } from './hooks/DebugContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DebugProvider>
      <App />
    </DebugProvider>
  </StrictMode>,
)

// Register PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registration successful with scope: ', reg.scope);

        const notifyUpdate = (worker) => {
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: worker }));
        };

        // If a new worker is already waiting, notify immediately
        if (reg.waiting) {
          notifyUpdate(reg.waiting);
        }

        // If a new worker is installing, monitor its state changes
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                notifyUpdate(installingWorker);
              }
            };
          }
        };
      })
      .catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
  });

  // Reload page when new service worker takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
