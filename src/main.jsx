import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initializeLanguage } from './i18n/languageController'

// Resolve the active UI language before the first render (stored choice, else
// browser language) so the app paints in the right language and the document's
// `lang` attribute is correct from the start (ADR 0026).
initializeLanguage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
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
        // worker's cache with a unique query string). It describes the changes
        // of the version that just became available.
        const fetchRelease = async () => {
          try {
            const res = await fetch(`/changelog.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !Array.isArray(data.changes) || data.changes.length === 0) return null;
            return data;
          } catch (err) {
            // Console-only by design: the changelog only enriches the update toast, and
            // the update itself is announced with or without it.
            console.error('Could not load changelog:', err);
            return null;
          }
        };

        const notifyUpdate = async (worker) => {
          const release = await fetchRelease();
          window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: { worker, release } }));
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
        // Console-only by design: without a service worker the app still runs fully, it
        // merely loses offline caching — there is nothing the user could act on.
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
