import { Link, router, useForm } from '@inertiajs/react';
import { Ban, Download, Gavel, HandCoins } from 'lucide-react';
import { useState } from 'react';
import { CancelPenaltyModal } from '@/components/cancel-penalty-modal';
import { Badge, Button, Card, Empty, Field, HowItWorks, Modal, MoneyInput, PageHeader, Select, Stat, Table, Td, Textarea, Th, formErrorBanner } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import type { Option } from '@/types';

type MemberRow = { id: number; name: string; role_label: string; accrued: number; settled: number; refunded: number; debt: number; count: number };
type Refund = { id: number; member: string | null; amount: number; method_label: string; reference: string | null; reason: string; receipt_number: string; task: { id: number; name: string } | null; refunded_by: string | null; refunded_at: string };
type PenaltyGroup = { task: { id: number; name: string; project: string | null; due_date: string; status_label: string }; member: string; member_id: number; count: number; total: number; cancelled_count: number; cancelled_total: number; active_ids: number[]; last_at: string };
type Cancellation = { key: number; member: string; task: { id: number; name: string | null }; count: number; amount: number; reason: string | null; cancelled_by: string | null; cancelled_at: string };
type Settlement = { id: number; member: string; type: string; type_label: string; amount: number; method_label: string | null; receipt: string | null; note: string | null; collected_by: string | null; settled_at: string };

function CollectModal({ member, methods, onClose }: { member: MemberRow; methods: Option[]; onClose: () => void }) {
    const form = useForm({ user_id: member.id, amount: member.debt as number | '', method: 'cash', note: '' });
    const submit = () => {
        form.transform((d) => ({ ...d, amount: Number(d.amount || 0) }));
        form.post('/penalties/collect', { preserveScroll: true, onSuccess: onClose });
    };
    return (
        <Modal
            open
            onClose={onClose}
            onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)}
            title={`Encaisser une pénalité — ${member.name}`}
            footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>Encaisser {form.data.amount ? fcfa(Number(form.data.amount)) : ''}</Button></>}
        >
            <div className="space-y-4">
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{member.name} doit actuellement <strong>{fcfa(member.debt)}</strong>.</p>
                <Field label="Montant (total ou partiel)" error={form.errors.amount}>
                    <MoneyInput value={form.data.amount} onChange={(v) => form.setData('amount', v)} />
                </Field>
                <Field label="Moyen" error={form.errors.method}>
                    <Select value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                        {methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                </Field>
                <Field label="Note" error={form.errors.note}>
                    <Textarea rows={2} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}

export default function PenaltiesIndex({ members, penalties, settlements, cancellations, refunds, filters, methods, config, canCollect, canCancel }: {
    members: MemberRow[];
    penalties: PenaltyGroup[];
    settlements: Settlement[];
    cancellations: Cancellation[];
    refunds: Refund[];
    filters: { member: number | null };
    methods: Option[];
    config: { enabled: boolean; amount: number; interval: number };
    canCollect: boolean;
    canCancel: boolean;
}) {
    const [collect, setCollect] = useState<MemberRow | null>(null);
    const [cancel, setCancel] = useState<{ ids: number[]; total: number; label: string; debt: number } | null>(null);
    const totalRefunded = members.reduce((s, m) => s + m.refunded, 0);
    const totalDebt = members.reduce((s, m) => s + m.debt, 0);
    const totalAccrued = members.reduce((s, m) => s + m.accrued, 0);

    return (
        <AppLayout title="Pénalités">
            <PageHeader
                title="Pénalités de retard"
                subtitle={config.enabled ? `Module actif : ${fcfa(config.amount)} tous les ${config.interval} jour(s) de retard, dès le 1er jour.` : 'Module désactivé : aucune nouvelle pénalité n\'est comptée, les dettes existantes restent dues.'}
                actions={<Badge tone={config.enabled ? 'green' : 'stone'}>{config.enabled ? 'Actif' : 'Désactivé'}</Badge>}
            />
            <HowItWorks
                id="penalties"
                title="Comment marchent les pénalités ?"
                steps={[
                    { title: 'Retard compté', text: config.enabled ? `Une tâche non livrée après sa date coûte ${fcfa(config.amount)}, dès le 1er jour, puis tous les ${config.interval} jour(s).` : 'Le module est désactivé dans les réglages : aucun retard n\'est compté.' },
                    { title: 'Pas pendant l\'attente', text: 'Une tâche qui attend une autre tâche n\'a pas de pénalité. Le compteur s\'arrête dès que le travail est livré.' },
                    { title: 'Retenue ou paiement', text: 'La dette est retirée du prochain versement au membre, ou il la règle directement (« Encaisser »).' },
                    { title: 'Annulation possible', text: 'L\'admin peut annuler une pénalité injuste avec un motif. Si elle était déjà payée, elle est remboursée.' },
                ]}
            />

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Total compté" value={fcfa(totalAccrued)} icon={<Gavel className="size-4" />} />
                <Stat label="Réglé" value={fcfa(totalAccrued - totalDebt)} tone="positive" hint={totalRefunded ? `Après ${fcfa(totalRefunded)} remboursés` : undefined} />
                <Stat label="Reste dû" value={fcfa(totalDebt)} tone={totalDebt ? 'negative' : undefined} />
            </div>

            <Card title="Par membre" className="mb-6">
                {members.length === 0 ? <Empty icon={<Gavel className="size-10" />} title="Aucune pénalité comptée." /> : (
                    <Table>
                        <thead><tr><Th>Membre</Th><Th className="text-right">Pénalités</Th><Th className="text-right">Compté</Th><Th className="text-right">Réglé</Th><Th className="text-right">Remboursé</Th><Th className="text-right">Doit</Th><Th /></tr></thead>
                        <tbody>
                            {members.map((m) => (
                                <tr key={m.id} className={filters.member === m.id ? 'bg-brand-50/50' : undefined}>
                                    <Td><button type="button" className="font-medium hover:underline" onClick={() => router.get('/penalties', filters.member === m.id ? {} : { member: m.id }, { preserveScroll: true })}>{m.name}</button><p className="text-xs text-stone-500">{m.role_label}</p></Td>
                                    <Td className="tabular text-right">{m.count}</Td>
                                    <Td className="tabular text-right">{fcfa(m.accrued)}</Td>
                                    <Td className="tabular text-right">{fcfa(m.settled)}</Td>
                                    <Td className="tabular text-right text-stone-500">{m.refunded ? fcfa(m.refunded) : '—'}</Td>
                                    <Td className={`tabular text-right font-semibold ${m.debt ? 'text-red-600' : 'text-stone-400'}`}>{fcfa(m.debt)}</Td>
                                    <Td className="text-right">{canCollect && m.debt > 0 && <Button size="sm" variant="secondary" onClick={() => setCollect(m)}><HandCoins className="size-3.5" />Encaisser</Button>}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title={filters.member ? 'Tâches pénalisées (filtré)' : 'Tâches pénalisées'} actions={filters.member ? <Button size="sm" variant="ghost" onClick={() => router.get('/penalties')}>Tout afficher</Button> : undefined}>
                    {penalties.length === 0 ? <Empty title="Aucune tâche pénalisée." /> : (
                        <ul className="-my-2 divide-y divide-stone-100">
                            {penalties.map((p) => (
                                <li key={p.task.id} className="flex items-start justify-between gap-3 py-2.5">
                                    <div className="min-w-0">
                                        <Link href={`/tasks/${p.task.id}`} className="text-sm font-medium hover:underline">{p.task.name}</Link>
                                        <p className="text-xs text-stone-500">{p.member} · {p.task.project} · échéance {date(p.task.due_date)} · {p.task.status_label}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="text-right">
                                            <p className={`tabular text-sm font-semibold ${p.total ? 'text-red-600' : 'text-stone-400'}`}>{fcfa(p.total)}</p>
                                            <p className="text-xs text-stone-500">{p.count} pénalité(s){p.cancelled_count > 0 && <span className="block text-stone-400">{p.cancelled_count} annulée(s) · {fcfa(p.cancelled_total)}</span>}</p>
                                        </div>
                                        {canCancel && p.active_ids.length > 0 && (
                                            <button type="button" title="Annuler ces pénalités" aria-label="Annuler ces pénalités" className="mt-0.5 rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => setCancel({ ids: p.active_ids, total: p.total, label: `${p.member} — « ${p.task.name} »`, debt: members.find((m) => m.id === p.member_id)?.debt ?? 0 })}>
                                                <Ban className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title="Règlements">
                    {settlements.length === 0 ? <Empty title="Aucun règlement." /> : (
                        <ul className="-my-2 divide-y divide-stone-100">
                            {settlements.map((s) => (
                                <li key={s.id} className="flex items-start justify-between gap-3 py-2.5">
                                    <div className="min-w-0 text-sm">
                                        <p className="font-medium">{s.member} <Badge tone={s.type === 'direct' ? 'violet' : 'blue'} className="ml-1">{s.type_label}</Badge></p>
                                        <p className="text-xs text-stone-500">{dateTime(s.settled_at)} · encaissé par {s.collected_by ?? '—'}{s.method_label ? ` · ${s.method_label}` : ''}{s.receipt ? ` · ${s.receipt}` : ''}</p>
                                        {s.note && <p className="text-xs text-stone-500">{s.note}</p>}
                                    </div>
                                    <span className="tabular text-sm font-semibold text-emerald-700">{fcfa(s.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
            {refunds.length > 0 && (
                <Card title="Remboursements aux membres" className="mt-6">
                    <ul className="-my-2 divide-y divide-stone-100">
                        {refunds.map((r) => (
                            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                                <div className="min-w-0 text-sm">
                                    <p className="font-medium">{r.member}{r.task && <> · <Link href={`/tasks/${r.task.id}`} className="font-normal hover:underline">{r.task.name}</Link></>}</p>
                                    <p className="text-xs text-stone-500">{dateTime(r.refunded_at)} · {r.receipt_number} · {r.method_label}{r.reference ? ` · ${r.reference}` : ''} · par {r.refunded_by ?? '—'}</p>
                                    <p className="text-xs text-stone-600">Motif : {r.reason}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="tabular text-sm font-semibold text-amber-700">− {fcfa(r.amount)}</span>
                                    {canCancel && <a href={`/penalty-refunds/${r.id}/receipt`} title="Reçu PDF" className="text-stone-400 hover:text-stone-900"><Download className="size-4" /></a>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
            {cancellations.length > 0 && (
                <Card title="Annulations" className="mt-6">
                    <ul className="-my-2 divide-y divide-stone-100">
                        {cancellations.map((c) => (
                            <li key={c.key} className="flex items-start justify-between gap-3 py-2.5">
                                <div className="min-w-0 text-sm">
                                    <p className="font-medium">{c.member} · <Link href={`/tasks/${c.task.id}`} className="font-normal hover:underline">{c.task.name}</Link></p>
                                    <p className="text-xs text-stone-500">{dateTime(c.cancelled_at)} · annulée(s) par {c.cancelled_by ?? '—'} · {c.count} pénalité(s)</p>
                                    <p className="text-xs text-stone-600">Motif : {c.reason}</p>
                                </div>
                                <span className="tabular text-sm font-semibold text-stone-500 line-through">{fcfa(c.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
            {cancel && <CancelPenaltyModal {...cancel} methods={methods} onClose={() => setCancel(null)} />}
            {collect && <CollectModal member={collect} methods={methods} onClose={() => setCollect(null)} />}
        </AppLayout>
    );
}
