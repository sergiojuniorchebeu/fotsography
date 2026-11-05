import { Head, usePage } from '@inertiajs/react';
import { Aperture } from 'lucide-react';
import type { ReactNode } from 'react';

export default function GuestLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
    const { studio } = usePage().props;
    return (
        <>
            <Head title={title} />
            <div className="grid min-h-screen lg:grid-cols-2">
                <div className="relative hidden overflow-hidden bg-ink lg:block">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(215,125,38,0.35),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(215,125,38,0.15),transparent_50%)]" />
                    <div className="relative flex h-full flex-col justify-between p-12 text-stone-300">
                        <div className="flex items-center gap-3">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-ink">
                                <Aperture className="size-6" />
                            </span>
                            <span className="text-lg font-semibold text-white">{studio?.name ?? 'Fotsography Studio'}</span>
                        </div>
                        <div>
                            <p className="max-w-md text-3xl leading-tight font-semibold text-white">Chaque projet, chaque tâche, chaque franc — au même endroit.</p>
                            <p className="mt-4 max-w-md text-sm text-stone-400">Clients, projets, équipe, paiements et pénalités du studio.</p>
                        </div>
                        <p className="text-xs text-stone-500">Espace interne · Cameroun</p>
                    </div>
                </div>
                <div className="flex items-center justify-center px-4 py-12 sm:px-6">
                    <div className="w-full max-w-sm">
                        <div className="mb-8 flex items-center gap-3 lg:hidden">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-brand-400">
                                <Aperture className="size-6" />
                            </span>
                            <span className="text-lg font-semibold">{studio?.name ?? 'Fotsography Studio'}</span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
                        <div className="mt-8">{children}</div>
                    </div>
                </div>
            </div>
        </>
    );
}
