import { api } from './api';
import { RUNTIME } from './uploads';

/**
 * Live repair alerts on the customer's phone (Web Push). Works in Chrome/Edge/Firefox/Samsung on
 * Android and computers; on iPhone only once the site is added to the Home Screen (iOS 16.4+).
 */
export type PushState = 'unsupported' | 'ios-install' | 'off' | 'on' | 'blocked';

type Auth = Record<string, string>;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function supported() {
  return !!RUNTIME.pushKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const followKey = (repairId: string) => `airride-alerts:${repairId}`;
const remember = (repairId: string, on: boolean) => {
  try {
    if (on) localStorage.setItem(followKey(repairId), '1');
    else localStorage.removeItem(followKey(repairId));
  } catch {
    /* private mode */
  }
};
const remembered = (repairId: string) => {
  try {
    return localStorage.getItem(followKey(repairId)) === '1';
  } catch {
    return false;
  }
};

export async function pushState(repairId: string): Promise<PushState> {
  if (!supported()) return isIos() && !isInstalled() && RUNTIME.pushKey ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  const sub = await (await registration()).pushManager.getSubscription();
  return sub && remembered(repairId) ? 'on' : 'off';
}

export async function enablePush(repairId: string, auth: Auth): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  // Some browsers (e.g. private/incognito windows) never answer: give up after 20 seconds.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Alerts could not be turned on in this browser. Try Chrome, or open the site outside private mode.')), 20_000),
  );
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(RUNTIME.pushKey!) }), timeout]));
  await api.post(`/track/${repairId}/push`, { subscription: sub.toJSON() }, { params: auth });
  remember(repairId, true);
  return 'on';
}

export async function disablePush(repairId: string, auth: Auth): Promise<PushState> {
  const sub = await (await registration()).pushManager.getSubscription();
  if (sub) await api.delete(`/track/${repairId}/push`, { params: auth, data: { endpoint: sub.endpoint } });
  // The same phone may follow other repairs, so the browser subscription itself is kept.
  remember(repairId, false);
  return 'off';
}
