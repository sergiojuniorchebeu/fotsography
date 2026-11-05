import { Link, router, usePage } from '@inertiajs/react';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { ProjectFormModal } from '@/components/project-form';
import { Badge, Button, Card, Empty, Input, PageHeader, Pagination, Progress, Select, Table, Td, Th, projectTone } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, fcfa } from '@/lib/format';
import type { Option, Paginated, Project } from '@/types';

export default function ProjectsIndex({
    projects,
    filters,
    statuses,
    clients,
    defaults,
    templates,
}: {
    projects: Paginated<Project>;
    filters: { q: string; status: string };
    statuses: Option[];
    clients: { id: number; name: string }[];
    defaults: { advance_pct: number; intermediate_pct: number; balance_pct: number };
    templates: { id: number; name: string }[];
}) {
    const admin = usePage().props.auth.user!.is_admin;
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState(filters.q ?? '');

    const apply = (next: Partial<typeof filters>) => router.get('/projects', { ...filters, q, ...next }, { preserveState: true, replace: true });

    return (
        <AppLayout title="Projets">
            <PageHeader
                title="Projets"
                subtitle={`${projects.total} projet(s)`}
                actions={admin && <Button onClick={() => setOpen(true)} disabled={clients.length === 0} title={clients.length === 0 ? 'Créez d\'abord un client' : undefined}><Plus className="size-4" />Nouveau projet</Button>}
            />
            <Card bodyClassName="p-5 pt-4">
                <form noValidate className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); apply({}); }}>
                    <div className="relative min-w-48 flex-1 sm:max-w-sm">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
                        <Input className="pl-9" placeholder="Projet ou client…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <Select className="w-auto" value={filters.status ?? ''} onChange={(e) => apply({ status: e.target.value })}>
                        <option value="">Tous les statuts</option>
                        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                </form>
                {projects.data.length === 0 ? (
                    <Empty icon={<FolderKanban className="size-10" />} title="Aucun projet">{admin ? (clients.length === 0 ? <>Commencez par <Link href="/clients" className="underline">créer un client</Link>.</> : 'Créez votre premier projet.') : 'Aucun projet pour le moment.'}</Empty>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Projet</Th><Th>Événement</Th><Th>Livraison</Th><Th>Avancement</Th>
                                {admin && <Th className="text-right">Montant</Th>}
                                {admin && <Th className="text-right">Encaissé</Th>}
                                <Th>Statut</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.data.map((p) => (
                                <tr key={p.id} className="cursor-pointer hover:bg-stone-50/60" onClick={() => router.visit(`/projects/${p.id}`)}>
                                    <Td><Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link><p className="text-xs text-stone-500">{p.client?.name}</p></Td>
                                    <Td className="text-stone-600">{date(p.event_date)}{p.location && <p className="text-xs text-stone-500">{p.location}</p>}</Td>
                                    <Td className="whitespace-nowrap text-stone-600">{date(p.delivery_date)}</Td>
                                    <Td className="w-40"><Progress value={p.tasks_done ?? 0} max={p.tasks_total ?? 0} /></Td>
                                    {admin && <Td className="tabular text-right">{fcfa(p.total_amount)}</Td>}
                                    {admin && <Td className="tabular text-right">{fcfa(p.paid)}</Td>}
                                    <Td><Badge tone={projectTone[p.status]}>{p.status_label}</Badge></Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
                <Pagination page={projects} />
            </Card>
            {admin && <ProjectFormModal open={open} onClose={() => setOpen(false)} clients={clients} statuses={statuses} defaults={defaults} templates={templates} />}
        </AppLayout>
    );
}
