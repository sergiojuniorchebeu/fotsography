import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Aperture,
    Bell,
    BellRing,
    CheckCircle2,
    ClipboardList,
    FolderKanban,
    Gavel,
    History,
    LayoutDashboard,
    LayoutTemplate,
    LogOut,
    Menu,
    MoreHorizontal,
    Settings,
    UserRound,
    Users,
    Wallet,
    X,
    XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmHost } from '@/components/confirm-dialog';
import { relative } from '@/lib/format';
import {
    currentSubscription,
    pushSupported,
    registerServiceWorker,
    subscribePush,
} from '@/lib/push';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';

type NavItem = { href: string; label: string; short?: string; icon: typeof Aperture };

function navFor(role: string, templates: boolean): NavItem[] {
    const dashboard = { href: '/', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard };
    if (role === 'admin' || role === 'super_admin') {
        return [
            dashboard,
            { href: '/projects', label: 'Projets', icon: FolderKanban },
            { href: '/tasks', label: 'Tâches', icon: ClipboardList },
            { href: '/clients', label: 'Clients', icon: UserRound },
            { href: '/finances', label: 'Finances', icon: Wallet },
            { href: '/penalties', label: 'Pénalités', icon: Gavel },
            { href: '/team', label: 'Équipe', icon: Users },
            ...(templates ? [{ href: '/templates', label: 'Modèles de projet', short: 'Modèles', icon: LayoutTemplate }] : []),
            { href: '/activity-log', label: "Journal d'activité", short: 'Journal', icon: History },
            { href: '/settings', label: 'Réglages', icon: Settings },
        ];
    }
    if (role === 'assistant') {
        return [
            dashboard,
            { href: '/projects', label: 'Projets', icon: FolderKanban },
            { href: '/tasks', label: 'Tâches', icon: ClipboardList },
            { href: '/penalties', label: 'Pénalités', icon: Gavel },
        ];
    }
    return [
        dashboard,
        { href: '/tasks', label: 'Mes tâches', icon: ClipboardList },
        { href: '/me/earnings', label: 'Mes gains', icon: Wallet },
        { href: '/notifications', label: 'Notifications', short: 'Alertes', icon: Bell },
    ];
}

function isActive(current: string, href: string): boolean {
    const path = current.split('?')[0];
    return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

function NotificationBell({ unread }: { unread: number }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<AppNotification[] | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }
        fetch('/notifications/recent', { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((d: { items: AppNotification[] }) => setItems(d.items))
            .catch(() => setItems([]));
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    // Light polling so the badge stays fresh while the app is open.
    useEffect(() => {
        const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                router.reload({ only: ['unreadNotifications'] });
            }
        }, 60_000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative rounded-full p-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                aria-label="Notifications"
            >
                <Bell className="size-5" />
                {unread > 0 && (
                    <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] leading-4 font-semibold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200">
                    <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                        <p className="text-sm font-semibold">Notifications</p>
                        {unread > 0 && (
                            <button
                                type="button"
                                className="text-xs text-stone-500 hover:text-stone-900"
                                onClick={() =>
                                    router.post('/notifications/read-all', {}, { preserveScroll: true, onSuccess: () => setItems((i) => i?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null) })
                                }
                            >
                                Tout marquer comme lu
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {items === null && <p className="p-4 text-sm text-stone-500">Chargement…</p>}
                        {items?.length === 0 && <p className="p-6 text-center text-sm text-stone-500">Aucune notification.</p>}
                        {items?.map((n) => (
                            <a
                                key={n.id}
                                href={`/notifications/${n.id}/open`}
                                className={cn('block border-b border-stone-50 px-4 py-3 hover:bg-stone-50', !n.read_at && 'bg-brand-50/60')}
                            >
                                <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                                    {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-brand-600" />}
                                    {n.title}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-xs text-stone-600">{n.body}</p>
                                <p className="mt-1 text-[11px] text-stone-400">{relative(n.created_at)}</p>
                            </a>
                        ))}
                    </div>
                    <Link href="/notifications" className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-medium text-stone-600 hover:bg-stone-50" onClick={() => setOpen(false)}>
                        Voir tout
                    </Link>
                </div>
            )}
        </div>
    );
}

function PushPrompt({ vapidKey }: { vapidKey: string | null }) {
    const [state, setState] = useState<'unknown' | 'off' | 'on' | 'denied' | 'unsupported'>('unknown');

    useEffect(() => {
        if (!vapidKey || !pushSupported()) {
            setState('unsupported');
            return;
        }
        void registerServiceWorker();
        if (Notification.permission === 'denied') {
            setState('denied');
            return;
        }
        void currentSubscription().then((s) => setState(s ? 'on' : 'off'));
    }, [vapidKey]);

    if (state !== 'off' || !vapidKey) {
        return null;
    }

    let dismissed = false;
    try {
        dismissed = localStorage.getItem('fst-push-dismissed') === '1';
    } catch {
        dismissed = false;
    }
    if (dismissed) {
        return null;
    }

    return (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-stone-100">
            <BellRing className="size-5 shrink-0 text-brand-400" />
            <p className="min-w-0 flex-1">Activez les notifications sur ce téléphone ou cet ordinateur pour être prévenu des tâches, échéances et paiements.</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-400"
                    onClick={() => void subscribePush(vapidKey).then((ok) => setState(ok ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off'))}
                >
                    Activer
                </button>
                <button
                    type="button"
                    className="rounded-lg px-3 py-1.5 text-xs text-stone-400 hover:text-white"
                    onClick={() => {
                        try {
                            localStorage.setItem('fst-push-dismissed', '1');
                        } catch {
                            /* ignore */
                        }
                        setState('unsupported');
                    }}
                >
                    Plus tard
                </button>
            </div>
        </div>
    );
}

function Flash() {
    const { flash } = usePage().props;
    const [visible, setVisible] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (flash.success) {
            setVisible({ type: 'success', text: flash.success });
        } else if (flash.error) {
            setVisible({ type: 'error', text: flash.error });
        }
    }, [flash]);

    useEffect(() => {
        if (!visible) {
            return;
        }
        const id = window.setTimeout(() => setVisible(null), 5000);
        return () => window.clearTimeout(id);
    }, [visible]);

    if (!visible) {
        return null;
    }
    return (
        <div className="fixed right-4 bottom-20 left-4 z-50 flex justify-center sm:left-auto sm:max-w-md lg:bottom-4">
            <div
                className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1',
                    visible.type === 'success' ? 'bg-white text-stone-800 ring-emerald-200' : 'bg-white text-stone-800 ring-red-200',
                )}
            >
                {visible.type === 'success' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />}
                <p className="min-w-0 flex-1 break-words select-all">{visible.text}</p>
                <button type="button" onClick={() => setVisible(null)} className="text-stone-400 hover:text-stone-700" aria-label="Fermer">
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}

/** Phone navigation: the main sections stay one thumb-tap away. */
function BottomNav({ nav, url, onMore }: { nav: NavItem[]; url: string; onMore: () => void }) {
    const primary = nav.length > 5 ? nav.slice(0, 4) : nav;
    const hasMore = nav.length > 5;
    const moreActive = hasMore && nav.slice(4).some((i) => isActive(url, i.href));
    const cell = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium';
    return (
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigation principale">
            {primary.map((item) => {
                const active = isActive(url, item.href);
                return (
                    <Link key={item.href} href={item.href} className={cn(cell, active ? 'text-ink' : 'text-stone-500')} aria-current={active ? 'page' : undefined}>
                        <item.icon className={cn('size-5', active && 'text-brand-600')} />
                        {item.short ?? item.label}
                    </Link>
                );
            })}
            {hasMore && (
                <button type="button" onClick={onMore} className={cn(cell, moreActive ? 'text-ink' : 'text-stone-500')}>
                    <MoreHorizontal className={cn('size-5', moreActive && 'text-brand-600')} />
                    Plus
                </button>
            )}
        </nav>
    );
}

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
    const page = usePage();
    const { auth, studio, unreadNotifications, vapidPublicKey } = page.props;
    const user = auth.user!;
    const [mobileOpen, setMobileOpen] = useState(false);
    const nav = navFor(user.role, !!page.props.features?.templates);

    useEffect(() => setMobileOpen(false), [page.url]);

    const sidebar = (
        <div className="flex h-full flex-col bg-ink text-stone-300">
            <Link href="/" className="flex items-center gap-3 px-5 py-5">
                {studio?.logo ? (
                    <img src={studio.logo} alt="" className="size-9 rounded-lg bg-white object-contain p-0.5" />
                ) : (
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-ink">
                        <Aperture className="size-5" />
                    </span>
                )}
                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{studio?.name ?? 'Fotsography Studio'}</span>
                    <span className="block text-[11px] tracking-wider text-stone-500 uppercase">Espace interne</span>
                </span>
            </Link>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
                {nav.map((item) => {
                    const active = isActive(page.url, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                                active ? 'bg-white/10 font-medium text-white' : 'hover:bg-white/5 hover:text-white',
                            )}
                        >
                            <item.icon className={cn('size-4.5', active ? 'text-brand-400' : 'text-stone-500')} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="border-t border-white/10 p-3">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                        {user.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">{user.name}</span>
                        <span className="block truncate text-xs text-stone-500">{user.role_label}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => router.post('/logout')}
                        className="rounded-md p-1.5 text-stone-500 hover:bg-white/10 hover:text-white"
                        title="Se déconnecter"
                        aria-label="Se déconnecter"
                    >
                        <LogOut className="size-4" />
                    </button>
                </div>
                <Link href="/password/change" className="block px-2 pt-1 text-xs text-stone-500 hover:text-stone-300">
                    Changer mon mot de passe
                </Link>
            </div>
        </div>
    );

    return (
        <>
            <Head title={title} />
            <div className="min-h-screen">
                <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
                {mobileOpen && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <div className="absolute inset-0 bg-stone-950/50" onClick={() => setMobileOpen(false)} />
                        <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</aside>
                    </div>
                )}
                <div className="lg:pl-64">
                    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200/70 bg-stone-50/85 px-4 backdrop-blur sm:px-6 lg:px-8">
                        <button type="button" className="-ml-1 rounded-md p-1.5 text-stone-600 hover:bg-stone-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu">
                            <Menu className="size-5" />
                        </button>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-stone-500">{title}</p>
                        <NotificationBell unread={unreadNotifications} />
                    </header>
                    <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:py-8">
                        <PushPrompt vapidKey={vapidPublicKey} />
                        {children}
                    </main>
                </div>
            </div>
            <BottomNav nav={nav} url={page.url} onMore={() => setMobileOpen(true)} />
            <Flash />
            <ConfirmHost />
        </>
    );
}
