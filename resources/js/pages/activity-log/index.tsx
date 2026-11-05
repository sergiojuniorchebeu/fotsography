import { router } from '@inertiajs/react';
import { History } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Empty, Input, PageHeader, Pagination, Select } from '@/components/ui';
import type { Tone } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { dateTime } from '@/lib/format';
import type { Paginated } from '@/types';

type Log = { id: number; action: string; description: string; subject_type: string | null; properties: Record<string, unknown> | null; user: string | null; ip: string | null; created_at: string };

const actions: Record<string, { label: string; tone: Tone }> = {
    created: { label: 'Création', tone: 'green' },
    updated: { label: 'Modification', tone: 'blue' },
    deleted: { label: 'Suppression', tone: 'red' },
    payment: { label: 'Paiement', tone: 'violet' },
};

export default function ActivityLogPage({ logs, filters, users }: { logs: Paginated<Log>; filters: { action?: string; user?: string; q?: string }; users: { id: number; name: string }[] }) {
    const [q, setQ] = useState(filters.q ?? '');
    const apply = (next: typeof filters) => router.get('/activity-log', Object.fromEntries(Object.entries({ ...filters, q, ...next }).filter(([, v]) => v)), { preserveState: true, replace: true });

    return (
        <AppLayout title="Journal d'activité">
            <PageHeader title="Journal d'activité" subtitle="Toutes les actions sensibles, avec la date et la personne." />
            <Card bodyClassName="p-5 pt-4">
                <form noValidate className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); apply({}); }}>
                    <Input className="w-auto min-w-48 flex-1 sm:max-w-xs" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <Select className="w-auto" value={filters.action ?? ''} onChange={(e) => apply({ action: e.target.value })}>
                        <option value="">Toutes les actions</option>
                        {Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </Select>
                    <Select className="w-auto" value={filters.user ?? ''} onChange={(e) => apply({ user: e.target.value })}>
                        <option value="">Toutes les personnes</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </Select>
                    <Button type="submit" variant="secondary">Filtrer</Button>
                </form>
                {logs.data.length === 0 ? <Empty icon={<History className="size-10" />} title="Aucune entrée." /> : (
                    <ul className="divide-y divide-stone-100">
                        {logs.data.map((l) => (
                            <li key={l.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3">
                                <span className="w-36 shrink-0 text-xs text-stone-500">{dateTime(l.created_at)}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm"><Badge tone={actions[l.action]?.tone ?? 'stone'} className="mr-2">{actions[l.action]?.label ?? l.action}</Badge>{l.description}</p>
                                    {l.properties && Object.keys(l.properties).length > 0 && (
                                        <details className="mt-1 text-xs text-stone-500">
                                            <summary className="cursor-pointer">Détails</summary>
                                            <pre className="mt-1 overflow-x-auto rounded-lg bg-stone-50 p-2 whitespace-pre-wrap">{JSON.stringify(l.properties, null, 2)}</pre>
                                        </details>
                                    )}
                                </div>
                                <span className="text-xs text-stone-500">{l.user ?? 'Système'}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <Pagination page={logs} />
            </Card>
        </AppLayout>
    );
}
