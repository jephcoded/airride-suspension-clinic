import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { setBusiness } from './lib/constants';
import { RUNTIME } from './lib/uploads';
import { setSite } from './lib/site';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 15_000 } },
});

function applyMeta(meta: { workshop?: Parameters<typeof setBusiness>[0]; uploadMode?: typeof RUNTIME.uploadMode; pushKey?: string | null; site?: Parameters<typeof setSite>[0] }) {
  if (meta.workshop) setBusiness(meta.workshop);
  if (meta.uploadMode) RUNTIME.uploadMode = meta.uploadMode;
  if (meta.pushKey) RUNTIME.pushKey = meta.pushKey;
  setSite(meta.site);
}

/** Business details: injected into the page by the server in production, fetched in development. */
async function loadBusiness() {
  const injected = document.getElementById('__business__')?.textContent;
  if (injected) {
    try {
      return applyMeta(JSON.parse(injected));
    } catch {
      /* fall through to fetch */
    }
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('/api/meta', { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) {
      applyMeta(await res.json());
    }
  } catch {
    /* fall back to defaults */
  }
}

loadBusiness().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
});

// Installed-app support: cache the website for instant, offline-tolerant loading (production only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
