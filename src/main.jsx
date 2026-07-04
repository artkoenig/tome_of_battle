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

// Register PWA service worker (production only). In dev the service worker's
// stale-while-revalidate cache would serve previous bundles on reload, masking
// code changes — so we skip registration and clean up any SW left over from a
// prior dev session.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('ServiceWorker registration successful with scope: ', reg.scope);

        // Fetch the freshly-deployed changelog (bypassing the old service
        // worker's cache with a unique query string) and return only the
        // entries newer than the version currently running.
        const fetchNewChanges = async () => {
          try {
            const res = await fetch(`/changelog.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return [];
            const entries = await res.json();
            if (!Array.isArray(entries)) return [];
            const idx = entries.findIndex((e) => e.version === __APP_VERSION__);
            // Entries listed before the running version (newest-first order) are
            // the new ones. If the running version isn't found, fall back to the
            // single newest entry so we still show something meaningful.
            return idx === -1 ? entries.slice(0, 1) : entries.slice(0, idx);
          } catch (err) {
            console.error('Could not load changelog:', err);
            return [];
          }
        };

        const notifyUpdate = async (worker) => {
          const changes = await fetchNewChanges();
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { worker, changes } }));
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
