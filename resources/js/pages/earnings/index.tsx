import { Link } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { Card, Empty, PageHeader, Stat } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { dateTime, fcfa } from '@/lib/format';
import type { MemberPayment } from '@/types';

type Summary = { fees_total: number; gross_paid: number; net_paid: number; withheld: number; remaining: number; penalties_total: number; penalty_debt: number; refunded: number };
type Refund = { id: number; amount: number; method_label: string; reason: string; receipt_number: string; refunded_at: string };

export default function Earnings({ summary: s, payments, penalties, settlements, refunds }: {
    summary: Summary;
    payments: MemberPayment[];
    penalties: { id: number; task: string | null; task_id: number; amount: number; days_late: number; accrued_at: string; cancelled_at: string | null; cancel_reason: string | null }[];
    settlements: { id: number; type_label: string; amount: number; note: string | null; collected_by: string | null; settled_at: string }[];
    refunds: Refund[];
}) {
    return (
        <AppLayout title="Mes gains">
            <PageHeader title="Mes gains" subtitle="Vos rémunérations, vos paiements reçus et vos pénalités." />
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Rémunération totale" value={fcfa(s.fees_total)} hint="Toutes mes tâches" />
                <Stat label="Reçu (net)" value={fcfa(s.net_paid)} tone="positive" hint={`Brut ${fcfa(s.gross_paid)} · retenu ${fcfa(s.withheld)}`} />
                <Stat label="À verser (brut)" value={fcfa(s.remaining)} tone={s.remaining ? 'warning' : undefined} hint="Tâches validées, avant retenues" />
                <Stat label="Pénalités dues" value={fcfa(s.penalty_debt)} tone={s.penalty_debt ? 'negative' : undefined} hint={`Total compté : ${fcfa(s.penalties_total)}`} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Paiements reçus" className="lg:col-span-2">
                    {payments.length === 0 ? <Empty title="Aucun paiement reçu pour l'instant." /> : (
                        <ul className="-my-2 divide-y divide-stone-100">
                            {payments.map((p) => (
                                <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                                    <div className="min-w-0 text-sm">
                                        {p.task && <Link href={`/tasks/${p.task.id}`} className="font-medium hover:underline">{p.task.name}</Link>}
                                        <p className="text-xs text-stone-500">{dateTime(p.paid_at)} · {p.method_label} · {p.receipt_number}</p>
                                        <p className="text-xs text-stone-500">Brut {fcfa(p.gross_amount)}{p.penalty_deducted ? ` − pénalité ${fcfa(p.penalty_deducted)}` : ''}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="tabular text-sm font-semibold text-emerald-700">{fcfa(p.net_amount)}</span>
                                        <a href={`/member-payments/${p.id}/receipt`} title="Reçu PDF" className="text-stone-400 hover:text-stone-900"><Download className="size-4" /></a>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <div className="space-y-6">
                    <Card title="Mes pénalités">
                        {penalties.length === 0 ? <Empty title="Aucune pénalité. Bravo !" /> : (
                            <ul className="space-y-2 text-sm">
                                {penalties.map((p) => (
                                    <li key={p.id} className="flex justify-between gap-2">
                                        <span className="min-w-0">
                                            <Link href={`/tasks/${p.task_id}`} className="block truncate hover:underline">{p.task}</Link>
                                            <span className="text-xs text-stone-500">{dateTime(p.accrued_at)} · {p.days_late} j de retard</span>
                                            {p.cancelled_at && <span className="block text-xs text-emerald-700">Annulée — {p.cancel_reason}</span>}
                                        </span>
                                        <span className={`tabular font-medium ${p.cancelled_at ? 'text-stone-400 line-through' : 'text-red-600'}`}>{fcfa(p.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                    {refunds.length > 0 && (
                        <Card title="Remboursements reçus">
                            <ul className="space-y-2 text-sm">
                                {refunds.map((r) => (
                                    <li key={r.id} className="flex justify-between gap-2">
                                        <span className="min-w-0">
                                            <span className="block">{r.method_label} · {r.receipt_number}</span>
                                            <span className="block text-xs text-stone-500">{dateTime(r.refunded_at)} — {r.reason}</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <span className="tabular font-medium text-emerald-700">+ {fcfa(r.amount)}</span>
                                            <a href={`/penalty-refunds/${r.id}/receipt`} title="Reçu PDF" className="text-stone-400 hover:text-stone-900"><Download className="size-4" /></a>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                    {settlements.length > 0 && (
                        <Card title="Pénalités réglées">
                            <ul className="space-y-2 text-sm">
                                {settlements.map((s2) => (
                                    <li key={s2.id} className="flex justify-between gap-2">
                                        <span><span className="block">{s2.type_label}</span><span className="text-xs text-stone-500">{dateTime(s2.settled_at)}</span></span>
                                        <span className="tabular font-medium">{fcfa(s2.amount)}</span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
