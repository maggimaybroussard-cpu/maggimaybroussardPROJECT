/**
 * Browser Push Notification utilities
 * Handles subscription management and sending push alerts
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return (
    typeof window !== 'undefined' && 'serviceWorker'in navigator && 'PushManager' in window &&
    'Notification' in window
  );
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return await Notification.requestPermission();
}

export async function subscribeToPush(userId?: string, userType?: 'client' | 'admin'): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
      return false;
    }

    const permission = await requestPushPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId: userId ?? null,
        userType: userType ?? 'client',
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    return await subscription.unsubscribe();
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err);
    return false;
  }
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  try {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Server-side: send a push notification to one or more subscribers
 * Call this from API routes only
 */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const res = await fetch('/api/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, payload }),
  });
  if (!res.ok) return { sent: 0, failed: 1 };
  return res.json();
}
