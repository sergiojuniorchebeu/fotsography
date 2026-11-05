import { Link, router, usePage } from '@inertiajs/react';
import { ClipboardList } from 'lucide-react';
import { DueChip } from '@/components/task-list';
import { workloadLabel } from '@/components/task-form';
import { Card, Empty, PageHeader, Pagination, Select, Table, Td, TaskStatusBadge, Th } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { fcfa } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Member, Paginated, Task } from '@/types';

type View = 'active' | 'review' | 'late' | 'waiting' | 'done' | 'all';
type Filters = { view?: View; member?: string; project?: string };

const TABS: { key: View; label: string; staffHint: string; memberHint: string }[] = [
    { key: 'active', label: 'En cours', staffHint: 'Tout ce qui n\'est pas terminé.', memberHint: 'Ce que vous avez à faire, ou que vous avez livré.' },
    { key: 'review', label: 'À vérifier', staffHint: 'Travail livré : ouvrez-le, puis validez ou renvoyez.', memberHint: 'Livré, en attente du contrôle de l\'admin.' },
    { key: 'late', label: 'En retard', staffHint: 'Date de livraison dépassée : les pénalités courent.', memberHint: 'Date dépassée : livrez au plus vite pour arrêter les pénalités.' },
    { key: 'waiting', label: 'En attente', staffHint: 'Bloquées par l\'étape d\'avant (pas de pénalité).', memberHint: 'Vous serez prévenu quand l\'étape d\'avant sera validée.' },
    { key: 'done', label: 'Terminées', staffHint: 'Validées et verrouillées.', memberHint: 'Validées : elles peuvent vous être payées.' },
    { key: 'all', label: 'Toutes', staffHint: '', memberHint: '' },
];

/** What the viewer should do next with this task, in a few words. */
function nextStep(t: Task, mine: boolean, admin: boolean): string | null {
    if (t.is_waiting) return null;
    if (t.status === 'review') return admin ? 'À contrôler' : mine ? 'Livré' : null;
    if (!mine) return null;
    if (t.status === 'todo') return 'À commencer';
    if (t.status === 'in_progress') return 'À livrer';
    return null;
}

function WorkloadStrip({ members, active, onPick }: { members: Member[]; active?: string; onPick: (id: string) => void }) {
    return (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {members.map((m) => {
                const selected = active === String(m.id);
                return (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => onPick(selected ? '' : String(m.id))}
                        className={cn('min-w-36 shrink-0 rounded-xl px-3 py-2 text-left ring-1 transition', selected ? 'bg-ink text-white ring-ink' : 'bg-white ring-stone-200 hover:ring-stone-300')}
                    >
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className={cn('truncate text-xs', selected ? 'text-stone-300' : m.late_count ? 'text-red-600' : 'text-stone-500')}>{workloadLabel(m)}</p>
                    </button>
                );
            })}
        </div>
    );
}

export default function TasksIndex({ tasks, view, counts, filters, workload, projects }: { tasks: Paginated<Task>; view: View; counts: Record<View, number>; filters: Filters; workload: Member[]; projects: { id: number; name: string }[] }) {
    const user = usePage().props.auth.user!;
    const staff = user.is_staff;
    const apply = (next: Filters) => router.get('/tasks', Object.fromEntries(Object.entries({ ...filters, ...next }).filter(([, v]) => v && v !== 'active')), { preserveState: true, preserveScroll: true, replace: true });
    const showFee = !user.is_staff || user.is_admin;
    const tab = TABS.find((t) => t.key === view)!;
    const hint = staff ? tab.staffHint : tab.memberHint;

    return (
        <AppLayout title={staff ? 'Tâches' : 'Mes tâches'}>
            <PageHeader title={staff ? 'Tâches' : 'Mes tâches'} subtitle={staff ? 'Qui fait quoi, pour quand. Cliquez sur une personne pour voir ses tâches.' : 'Commencez une tâche, puis livrez votre travail avant la date.'} />

            {staff && workload.length > 0 && <WorkloadStrip members={workload} active={filters.member} onPick={(id) => apply({ member: id })} />}

            <Card bodyClassName="p-5 pt-4">
                <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto border-b border-stone-100 px-1">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => apply({ view: t.key })}
                            className={cn('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm', view === t.key ? 'border-ink font-semibold text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}
                        >
                            {t.label}
                            <span className={cn('tabular rounded-full px-1.5 text-xs', t.key === 'late' && counts.late ? 'bg-red-100 text-red-700' : t.key === 'review' && counts.review ? 'bg-sky-100 text-sky-800' : 'bg-stone-100 text-stone-600')}>{counts[t.key]}</span>
                        </button>
                    ))}
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-stone-500">{hint}</p>
                    {staff && (
                        <Select className="w-auto max-w-56" value={filters.project ?? ''} onChange={(e) => apply({ project: e.target.value })}>
                            <option value="">Tous les projets en cours</option>
                            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                    )}
                </div>

                {tasks.data.length === 0 ? (
                    <Empty icon={<ClipboardList className="size-10" />} title={view === 'late' ? 'Aucune tâche en retard. 👏' : 'Aucune tâche ici.'} />
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Tâche</Th>{staff && <Th>Assignée à</Th>}<Th>Échéance</Th><Th>Statut</Th>
                                {showFee && <Th className="text-right">Rémunération</Th>}
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.data.map((t) => {
                                const step = nextStep(t, t.assignee?.id === user.id, user.is_admin);
                                return (
                                    <tr key={t.id} className="cursor-pointer hover:bg-stone-50/60" onClick={() => router.visit(`/tasks/${t.id}`)}>
                                        <Td>
                                            <Link href={`/tasks/${t.id}`} className="font-medium" onClick={(e) => e.stopPropagation()}>{t.name}</Link>
                                            <p className="max-w-72 truncate text-xs text-stone-500">{t.project?.name} · {t.activity?.name}</p>
                                            {t.is_waiting && t.dependency && <p className="max-w-72 truncate text-xs text-stone-500">Après « {t.dependency.name} » ({t.dependency.assignee})</p>}
                                        </Td>
                                        {staff && <Td className="text-stone-600">{t.assignee?.name ?? '—'}</Td>}
                                        <Td><DueChip task={t} /></Td>
                                        <Td>
                                            <TaskStatusBadge status={t.status} label={t.status_label} late={t.is_late} waiting={t.is_waiting} />
                                            {step && <p className="mt-1 text-xs font-medium text-stone-700">→ {step}</p>}
                                        </Td>
                                        {showFee && <Td className="tabular text-right">{t.member_fee !== undefined ? fcfa(t.member_fee) : '—'}</Td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                )}
                <Pagination page={tasks} />
            </Card>
        </AppLayout>
    );
}
