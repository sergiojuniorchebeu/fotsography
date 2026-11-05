import { Link } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { MonthlyChart } from '@/components/finance-chart';
import { Badge, ButtonLink, Card, PageHeader, Stat, Table, Td, Th, projectTone } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import type { ClientPayment, FinanceSummary, MemberPayment, MemberStat, MonthPoint } from '@/types';

type ProjectRow = { id: number; name: string; client: string | null; status: string; status_label: string; delivery_date: string; revenue: number; collected: number; remaining: number; expenses: number; fees_planned: number; fees_paid: number; margin: number };

const exports = [
    ['projets', 'Projets'],
    ['encaissements', 'Encaissements'],
    ['remunerations', 'Rémunérations'],
    ['depenses', 'Dépenses'],
    ['penalites', 'Pénalités'],
    ['membres', 'Membres'],
] as const;

export default function Finances({ summary: s, projects, monthly, members, recentPayments, recentMemberPayments }: {
    summary: FinanceSummary;
    projects: ProjectRow[];
    monthly: MonthPoint[];
    members: MemberStat[];
    recentPayments: ClientPayment[];
    recentMemberPayments: MemberPayment[];
}) {
    return (
        <AppLayout title="Finances">
            <PageHeader title="Finances" subtitle="Marge nette = encaissé − dépenses − rémunérations versées − remboursements de pénalités." />
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Chiffre d'affaires" value={fcfa(s.revenue)} hint="Projets non annulés" />
                <Stat label="Encaissé" value={fcfa(s.collected)} tone="positive" />
                <Stat label="Reste à encaisser" value={fcfa(s.remaining)} tone={s.remaining ? 'warning' : undefined} />
                <Stat label="Marge nette" value={fcfa(s.margin)} tone={s.margin >= 0 ? 'positive' : 'negative'} />
            </div>
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Dépenses" value={fcfa(s.expenses)} />
                <Stat label="Rémunérations versées" value={fcfa(s.fees_paid)} hint="Montants nets" />
                <Stat label="Pénalités retenues" value={fcfa(s.withheld)} />
                <Stat label="Pénalités réglées (net)" value={fcfa(s.penalties_collected)} hint={s.penalty_refunds ? `Retenues + paiements directs − ${fcfa(s.penalty_refunds)} remboursés` : 'Retenues + paiements directs'} />
            </div>

            <Card title="Exports CSV" className="mb-6">
                <div className="flex flex-wrap gap-2">
                    {exports.map(([key, label]) => (
                        <ButtonLink key={key} href={`/finances/export/${key}`} external size="sm"><Download className="size-3.5" />{label}</ButtonLink>
                    ))}
                </div>
            </Card>

            <Card title="Évolution sur 12 mois" className="mb-6"><MonthlyChart data={monthly} /></Card>

            <Card title="Par projet" className="mb-6">
                <Table>
                    <thead>
                        <tr><Th>Projet</Th><Th>Statut</Th><Th className="text-right">CA</Th><Th className="text-right">Encaissé</Th><Th className="text-right">Reste</Th><Th className="text-right">Dépenses</Th><Th className="text-right">Rému. versées</Th><Th className="text-right">Marge</Th></tr>
                    </thead>
                    <tbody>
                        {projects.map((p) => (
                            <tr key={p.id} className="hover:bg-stone-50/60">
                                <Td><Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link><p className="text-xs text-stone-500">{p.client} · {date(p.delivery_date)}</p></Td>
                                <Td><Badge tone={projectTone[p.status]}>{p.status_label}</Badge></Td>
                                <Td className="tabular text-right">{fcfa(p.revenue)}</Td>
                                <Td className="tabular text-right">{fcfa(p.collected)}</Td>
                                <Td className="tabular text-right">{fcfa(p.remaining)}</Td>
                                <Td className="tabular text-right">{fcfa(p.expenses)}</Td>
                                <Td className="tabular text-right">{fcfa(p.fees_paid)}<p className="text-xs text-stone-400">/ {fcfa(p.fees_planned)}</p></Td>
                                <Td className={`tabular text-right font-semibold ${p.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fcfa(p.margin)}</Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>

            <Card title="Par membre" className="mb-6">
                <Table>
                    <thead>
                        <tr><Th>Membre</Th><Th className="text-right">Tâches</Th><Th className="text-right">Terminées</Th><Th className="text-right">En retard</Th><Th className="text-right">Rémunération</Th><Th className="text-right">Versé net</Th><Th className="text-right">Reste dû</Th><Th className="text-right">Pénalités</Th><Th className="text-right">Doit</Th></tr>
                    </thead>
                    <tbody>
                        {members.map((m) => (
                            <tr key={m.id}>
                                <Td><p className="font-medium">{m.name}</p><p className="text-xs text-stone-500">{m.role_label}{!m.is_active && ' · désactivé'}</p></Td>
                                <Td className="tabular text-right">{m.tasks}</Td>
                                <Td className="tabular text-right">{m.done}</Td>
                                <Td className="tabular text-right">{m.late}</Td>
                                <Td className="tabular text-right">{fcfa(m.fees_total)}</Td>
                                <Td className="tabular text-right">{fcfa(m.net_paid)}</Td>
                                <Td className="tabular text-right">{fcfa(m.remaining)}</Td>
                                <Td className="tabular text-right">{fcfa(m.penalties)}</Td>
                                <Td className={`tabular text-right ${m.penalty_debt ? 'font-semibold text-red-600' : ''}`}>{fcfa(m.penalty_debt)}</Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Derniers encaissements clients">
                    <ul className="-my-2 divide-y divide-stone-100">
                        {recentPayments.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                <div className="min-w-0"><p className="truncate font-medium">{p.project?.name}</p><p className="text-xs text-stone-500">{p.receipt_number} · {p.type_label} · {dateTime(p.paid_at)}</p></div>
                                <a href={`/client-payments/${p.id}/receipt`} className="tabular font-semibold text-emerald-700 hover:underline">{fcfa(p.amount)}</a>
                            </li>
                        ))}
                        {recentPayments.length === 0 && <li className="py-4 text-center text-sm text-stone-500">Aucun encaissement.</li>}
                    </ul>
                </Card>
                <Card title="Derniers versements aux membres">
                    <ul className="-my-2 divide-y divide-stone-100">
                        {recentMemberPayments.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                                <div className="min-w-0"><p className="truncate font-medium">{p.member} — {p.task?.name}</p><p className="text-xs text-stone-500">{p.receipt_number} · {dateTime(p.paid_at)}{p.penalty_deducted ? ` · retenue ${fcfa(p.penalty_deducted)}` : ''}</p></div>
                                <a href={`/member-payments/${p.id}/receipt`} className="tabular font-semibold hover:underline">{fcfa(p.net_amount)}</a>
                            </li>
                        ))}
                        {recentMemberPayments.length === 0 && <li className="py-4 text-center text-sm text-stone-500">Aucun versement.</li>}
                    </ul>
                </Card>
            </div>
        </AppLayout>
    );
}
