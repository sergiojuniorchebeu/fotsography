import { router, usePage } from '@inertiajs/react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Card, Empty, PageHeader, Pagination } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { dateTime } from '@/lib/format';
import { currentSubscription, pushSupported, subscribePush, unsubscribePush } from '@/lib/push';
import { cn } from '@/lib/utils';
import type { AppNotification, Paginated } from '@/types';

function PushToggle() {
    const key = usePage().props.vapidPublicKey;
    const [on, setOn] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void currentSubscription().then((s) => setOn(!!s));
    }, []);

    if (!key || !pushSupported()) {
        return <p className="text-sm text-stone-500">Les notifications sur l'appareil ne sont pas disponibles sur ce navigateur. Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil (Partager → Sur l'écran d'accueil).</p>;
    }
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-stone-700">
                {on ? <BellRing className="size-4 text-emerald-600" /> : <BellOff className="size-4 text-stone-400" />}
                {on ? 'Notifications activées sur cet appareil.' : 'Notifications désactivées sur cet appareil.'}
            </p>
            <Button
                size="sm"
                variant={on ? 'secondary' : 'primary'}
                loading={busy}
                onClick={async () => {
                    setBusy(true);
                    if (on) {
                        await unsubscribePush();
                        setOn(false);
                    } else {
                        setOn(await subscribePush(key));
                    }
                    setBusy(false);
                }}
            >
                {on ? 'Désactiver' : 'Activer sur cet appareil'}
            </Button>
        </div>
    );
}

export default function NotificationsPage({ notifications }: { notifications: Paginated<AppNotification> }) {
    const unread = usePage().props.unreadNotifications;
    return (
        <AppLayout title="Notifications">
            <PageHeader title="Notifications" actions={unread > 0 && <Button variant="secondary" onClick={() => router.post('/notifications/read-all', {}, { preserveScroll: true })}>Tout marquer comme lu</Button>} />
            <Card className="mb-6"><PushToggle /></Card>
            <Card bodyClassName="p-0">
                {notifications.data.length === 0 ? <Empty icon={<Bell className="size-10" />} title="Aucune notification." /> : (
                    <ul className="divide-y divide-stone-100">
                        {notifications.data.map((n) => (
                            <li key={n.id}>
                                <a href={`/notifications/${n.id}/open`} className={cn('flex gap-3 px-5 py-4 hover:bg-stone-50', !n.read_at && 'bg-brand-50/50')}>
                                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand-600')} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-medium">{n.title}</span>
                                        <span className="block text-sm text-stone-600">{n.body}</span>
                                        <span className="mt-1 block text-xs text-stone-400">{dateTime(n.created_at)}</span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="px-5 pb-4"><Pagination page={notifications} /></div>
            </Card>
        </AppLayout>
    );
}
