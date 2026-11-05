function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) {
        out[i] = raw.charCodeAt(i);
    }
    return out;
}

function csrf(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

export function pushSupported(): boolean {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
        return null;
    }
    try {
        return await navigator.serviceWorker.register('/sw.js');
    } catch {
        return null;
    }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
    if (!pushSupported()) {
        return null;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
}

export async function subscribePush(vapidPublicKey: string): Promise<boolean> {
    if (!pushSupported()) {
        return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        return false;
    }
    const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    await navigator.serviceWorker.ready;
    const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
    const json = sub.toJSON();
    const encoding = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings?.[0] ?? 'aesgcm';
    const res = await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': csrf() },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, contentEncoding: encoding }),
    });
    return res.ok;
}

export async function unsubscribePush(): Promise<void> {
    const sub = await currentSubscription();
    if (!sub) {
        return;
    }
    await fetch('/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': csrf() },
        body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
}
