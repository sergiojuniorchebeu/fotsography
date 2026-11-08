import { confirmDialog } from '@/components/confirm-dialog';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { BookmarkPlus, CalendarDays, Download, FileText, LayoutTemplate, ListChecks, MapPin, Pencil, Plus, Receipt, Trash2, Wand2 } from 'lucide-react';
import { ApplyTemplateModal } from '@/components/apply-template-modal';
import { useState } from 'react';
import { ProjectFormModal } from '@/components/project-form';
import { DueChip } from '@/components/task-list';
import { TaskFormModal } from '@/components/task-form';
import { Badge, Button, Card, Empty, Field, HowItWorks, Input, Modal, MoneyInput, PageHeader, Select, Stat, Table, Td, TaskStatusBadge, Textarea, Th, projectTone, formErrorBanner } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import type { Activity, ClientPayment, Expense, Member, MemberPayment, Option, Project, SiblingTask, Task, TemplatePreview } from '@/types';

type PlanRow = { type: string; label: string; amount: number; paid: boolean };
type Financials = { revenue: number; collected: number; remaining: number; expenses: number; fees_paid: number; fees_due: number; fees_planned: number; client_shares: number; refunds: number; margin: number };

type Props = {
    project: Project;
    activities: Activity[];
    members: Member[];
    siblings: SiblingTask[];
    templates: TemplatePreview[];
    shareLeft: number | null;
    defaultTaskDueDate: string;
    statuses: Option[];
    plan?: PlanRow[];
    payments?: ClientPayment[];
    financials?: Financials;
    invoice?: { id: number; number: string; issued_at: string } | null;
    clients?: { id: number; name: string }[];
    methods?: Option[];
    memberPayments?: MemberPayment[];
};

function ActivityModal({ open, onClose, projectId, activity }: { open: boolean; onClose: () => void; projectId: number; activity?: Activity }) {
    const form = useForm({ name: activity?.name ?? '', description: activity?.description ?? '' });
    const submit = () => {
        const opts = { preserveScroll: true, onSuccess: () => { onClose(); if (!activity) { form.reset(); } } };
        if (activity) {
            form.put(`/activities/${activity.id}`, opts);
        } else {
            form.post(`/projects/${projectId}/activities`, opts);
        }
    };
    return (
        <Modal open={open} onClose={onClose} onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)} title={activity ? 'Modifier l\'activité' : 'Nouvelle activité'} description="Une partie du projet (Photo, Vidéo, Album…) qui regroupe des tâches et des dépenses." footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>Enregistrer</Button></>}>
            <div className="space-y-4">
                <Field label="Nom" error={form.errors.name}>
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Shooting, Montage vidéo, Retouche photos…" />
                </Field>
                <Field label="Description" error={form.errors.description}>
                    <Textarea value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}

function PaymentModal({ open, onClose, project, plan, methods, preset, remaining }: { open: boolean; onClose: () => void; project: Project; plan: PlanRow[]; methods: Option[]; preset: string; remaining: number }) {
    const form = useForm({
        type: preset,
        amount: (plan.find((p) => p.type === preset)?.amount ?? '') as number | '',
        method: 'cash',
        reference: '',
        note: '',
        paid_at: new Date().toISOString().slice(0, 10),
    });
    const setType = (type: string) => {
        form.setData((d) => ({ ...d, type, amount: plan.find((p) => p.type === type)?.amount ?? '' }));
    };
    const submit = () => {
        form.transform((d) => ({ ...d, amount: d.amount === '' ? null : Number(d.amount) }));
        form.post(`/projects/${project.id}/payments`, { preserveScroll: true, onSuccess: () => { onClose(); form.reset(); } });
    };
    return (
        <Modal open={open} onClose={onClose} onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)} title="Enregistrer un encaissement" description={`Reste à payer : ${fcfa(remaining)}`} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>Encaisser {form.data.amount ? fcfa(Number(form.data.amount)) : ''}</Button></>}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" error={form.errors.type} className="sm:col-span-2">
                    <Select value={form.data.type} onChange={(e) => setType(e.target.value)}>
                        {plan.map((p) => <option key={p.type} value={p.type} disabled={p.paid}>{p.label} — {fcfa(p.amount)}{p.paid ? ' (déjà encaissée)' : ''}</option>)}
                        <option value="free">Versement libre</option>
                    </Select>
                </Field>
                <Field label="Montant" error={form.errors.amount} className="sm:col-span-2" hint={form.data.type === 'free' ? <>Ne peut pas dépasser le reste à payer. <button type="button" className="font-medium text-stone-700 underline" onClick={() => form.setData('amount', remaining)}>Tout le reste ({fcfa(remaining)})</button></> : 'Montant prévu par le plan, modifiable.'}>
                    <MoneyInput value={form.data.amount} onChange={(v) => form.setData('amount', v)} />
                </Field>
                <Field label="Moyen de paiement" error={form.errors.method}>
                    <Select value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                        {methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                </Field>
                <Field label="Date" error={form.errors.paid_at}>
                    <Input type="date" value={form.data.paid_at} onChange={(e) => form.setData('paid_at', e.target.value)} />
                </Field>
                <Field label="Référence" error={form.errors.reference} className="sm:col-span-2">
                    <Input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} placeholder="N° de transaction MoMo / OM, virement…" />
                </Field>
                <Field label="Note" error={form.errors.note} className="sm:col-span-2">
                    <Textarea rows={2} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}

function ExpenseModal({ open, onClose, activityId, expense }: { open: boolean; onClose: () => void; activityId?: number; expense?: Expense }) {
    const form = useForm({
        description: expense?.description ?? '',
        supplier: expense?.supplier ?? '',
        amount: (expense?.amount ?? '') as number | '',
        spent_at: expense?.spent_at ?? new Date().toISOString().slice(0, 10),
    });
    const submit = () => {
        form.transform((d) => ({ ...d, amount: Number(d.amount || 0) }));
        const opts = { preserveScroll: true, onSuccess: () => { onClose(); if (!expense) { form.reset(); } } };
        if (expense) {
            form.put(`/expenses/${expense.id}`, opts);
        } else {
            form.post(`/activities/${activityId}/expenses`, opts);
        }
    };
    return (
        <Modal open={open} onClose={onClose} onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)} title={expense ? 'Modifier la dépense' : 'Nouvelle dépense'} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>Enregistrer</Button></>}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Description" error={form.errors.description} className="sm:col-span-2">
                    <Input autoFocus value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Location drone, transport, impression album…" />
                </Field>
                <Field label="Fournisseur" error={form.errors.supplier}>
                    <Input value={form.data.supplier} onChange={(e) => form.setData('supplier', e.target.value)} />
                </Field>
                <Field label="Date" error={form.errors.spent_at}>
                    <Input type="date" value={form.data.spent_at} onChange={(e) => form.setData('spent_at', e.target.value)} />
                </Field>
                <Field label="Montant" error={form.errors.amount} className="sm:col-span-2">
                    <MoneyInput value={form.data.amount} onChange={(v) => form.setData('amount', v)} />
                </Field>
            </div>
        </Modal>
    );
}

function ActivityCard({ activity, admin, onAddTask, onEditTask, onEdit, onAddExpense, onEditExpense }: {
    activity: Activity;
    admin: boolean;
    onAddTask: () => void;
    onEditTask: (t: Task) => void;
    onEdit: () => void;
    onAddExpense: () => void;
    onEditExpense: (e: Expense) => void;
}) {
    const expensesTotal = activity.expenses.reduce((s, e) => s + e.amount, 0);
    return (
        <Card
            title={<span className="flex items-center gap-2">{activity.name}<Badge>{activity.tasks.length} tâche(s)</Badge></span>}
            actions={
                <>
                    <Button size="sm" variant="secondary" onClick={onAddTask}><Plus className="size-3.5" />Tâche</Button>
                    {admin && <Button size="sm" variant="secondary" onClick={onAddExpense}><Plus className="size-3.5" />Dépense</Button>}
                    <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Modifier l'activité"><Pencil className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Supprimer l'activité" onClick={() => void confirmDialog({ title: 'Archiver l\'activité', confirmLabel: 'Archiver', message: <>L'activité « {activity.name} », ses {activity.tasks.length} tâche(s) et ses dépenses seront archivées. Impossible si une tâche est terminée ou déjà payée.</>, request: { method: 'delete', url: `/activities/${activity.id}` } })}><Trash2 className="size-3.5" /></Button>
                </>
            }
        >
            {activity.description && <p className="mb-3 text-sm text-stone-500">{activity.description}</p>}
            {activity.tasks.length === 0 ? (
                <Empty title="Aucune tâche dans cette activité.">Ajoutez-en une avec le bouton « Tâche ».</Empty>
            ) : (
                <Table>
                    <thead>
                        <tr>
                            <Th>Tâche</Th><Th>Assignée à</Th><Th>Échéance</Th><Th>Statut</Th>
                            {admin && <Th className="text-right">Rémunération</Th>}
                            <Th />
                        </tr>
                    </thead>
                    <tbody>
                        {activity.tasks.map((t) => (
                            <tr key={t.id} className="hover:bg-stone-50/60">
                                <Td>
                                    <Link href={`/tasks/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                                    {t.dependency && <p className="text-xs text-stone-500">après « {t.dependency.name} »</p>}
                                </Td>
                                <Td className="text-stone-600">{t.assignee?.name ?? '—'}</Td>
                                <Td><DueChip task={t} /></Td>
                                <Td><TaskStatusBadge status={t.status} label={t.status_label} late={t.is_late} waiting={t.is_waiting} /></Td>
                                {admin && <Td className="tabular text-right">{fcfa(t.member_fee)}</Td>}
                                <Td className="text-right">
                                    {(admin || t.status !== 'done') && (
                                        <button type="button" className="text-stone-400 hover:text-stone-900" onClick={() => onEditTask(t)} aria-label="Modifier"><Pencil className="size-4" /></button>
                                    )}
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
            {admin && activity.expenses.length > 0 && (
                <div className="mt-5">
                    <p className="mb-2 flex justify-between text-xs font-medium tracking-wide text-stone-500 uppercase"><span>Dépenses</span><span className="tabular">{fcfa(expensesTotal)}</span></p>
                    <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-100">
                        {activity.expenses.map((e) => (
                            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate">{e.description}</p>
                                    <p className="text-xs text-stone-500">{date(e.spent_at)}{e.supplier ? ` · ${e.supplier}` : ''}{e.recorded_by ? ` · par ${e.recorded_by}` : ''}</p>
                                </div>
                                <span className="tabular font-medium">{fcfa(e.amount)}</span>
                                <button type="button" className="text-stone-400 hover:text-stone-900" onClick={() => onEditExpense(e)} aria-label="Modifier"><Pencil className="size-3.5" /></button>
                                <button type="button" className="text-stone-400 hover:text-red-600" aria-label="Supprimer" onClick={() => void confirmDialog({ title: 'Archiver la dépense', confirmLabel: 'Archiver', message: <>« {e.description} » ({fcfa(e.amount)}) ne comptera plus dans les dépenses du projet. L'action reste visible dans le journal.</>, request: { method: 'delete', url: `/expenses/${e.id}` } })}><Trash2 className="size-3.5" /></button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Card>
    );
}

/** Splits the project price between its tasks; each line appears on the client's invoice. */
function InvoiceLinesModal({ open, onClose, projectId, total, activities }: { open: boolean; onClose: () => void; projectId: number; total: number; activities: Activity[] }) {
    const tasks = activities.flatMap((a) => a.tasks.map((t) => ({ ...t, activityName: a.name })));
    const form = useForm<{ lines: Record<string, number | ''> }>({ lines: Object.fromEntries(tasks.map((t) => [String(t.id), t.client_share ? t.client_share : ''])) });
    const sum = Object.values(form.data.lines).reduce<number>((s, v) => s + Number(v || 0), 0);
    const left = total - sum;

    // Proportional to what each person is paid (the bigger the job, the bigger the line); equal split otherwise.
    const auto = () => {
        const weights = tasks.map((t) => t.member_fee ?? 0);
        const base = weights.some((w) => w > 0) ? weights : tasks.map(() => 1);
        const wsum = base.reduce((a, b) => a + b, 0);
        let given = 0;
        const lines: Record<string, number | ''> = {};
        tasks.forEach((t, i) => {
            const amount = i === tasks.length - 1 ? total - given : Math.round(((total * base[i]) / wsum) / 1000) * 1000;
            given += amount;
            lines[String(t.id)] = amount || '';
        });
        form.setData('lines', lines);
    };
    const clear = () => form.setData('lines', Object.fromEntries(tasks.map((t) => [String(t.id), ''])));

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            dirty={form.isDirty}
            errorBanner={formErrorBanner(form.errors)}
            title="Détail de la facture"
            description={<>Facultatif. Indiquez combien le client paie pour chaque prestation : chaque ligne apparaîtra sur sa facture. Sans détail, la facture affiche simplement le prix total ({fcfa(total)}).</>}
            onSubmit={() => {
                form.transform((d) => ({ lines: Object.fromEntries(Object.entries(d.lines).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }));
                form.put(`/projects/${projectId}/invoice-lines`, { preserveScroll: true, onSuccess: onClose });
            }}
            footer={
                <>
                    <p className={`mr-auto text-sm ${left < 0 ? 'font-medium text-red-600' : 'text-stone-600'}`}>
                        {sum === 0 ? 'Facture au montant global' : left === 0 ? '✓ Tout le prix est réparti' : left > 0 ? `Reste ${fcfa(left)} non détaillé` : `Dépasse de ${fcfa(-left)}`}
                    </p>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing} disabled={left < 0}>Enregistrer</Button>
                </>
            }
        >
            {tasks.length === 0 ? <Empty title="Ajoutez d'abord les tâches du projet." /> : (
                <>
                    <div className="mb-4 flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={auto}><Wand2 className="size-4" />Répartir automatiquement</Button>
                        <Button variant="ghost" onClick={clear}>Tout effacer</Button>
                    </div>
                    <p className="mb-3 text-xs text-stone-500">« Répartir automatiquement » partage les {fcfa(total)} selon ce que chaque personne est payée (ou à parts égales). Vous pouvez ensuite ajuster chaque montant.</p>
                    <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-100">
                        {tasks.map((t) => (
                            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{t.name}</p>
                                    <p className="truncate text-xs text-stone-500">{t.activityName}{t.member_fee ? ` · payé ${fcfa(t.member_fee)} à ${t.assignee?.name ?? '—'}` : ''}</p>
                                </div>
                                <MoneyInput className="w-40" value={form.data.lines[String(t.id)] ?? ''} onChange={(v) => form.setData('lines', { ...form.data.lines, [String(t.id)]: v })} />
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </Modal>
    );
}

function SaveTemplateModal({ projectId, projectName, onClose }: { projectId: number; projectName: string; onClose: () => void }) {
    const form = useForm({ name: projectName });
    return (
        <Modal
            open
            onClose={onClose}
            size="sm"
            title="Enregistrer comme modèle"
            description="Les activités, tâches, rôles, délais, rémunérations, parts client et enchaînements de ce projet deviennent un modèle réutilisable. Les personnes et les dates exactes ne sont pas gardées."
            onSubmit={() => form.post(`/projects/${projectId}/save-as-template`, { preserveScroll: true, onSuccess: onClose })}
            errorBanner={formErrorBanner(form.errors)}
            footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>Enregistrer le modèle</Button></>}
        >
            <Field label="Nom du modèle" error={form.errors.name}>
                <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Mariage formule complète" />
            </Field>
        </Modal>
    );
}

export default function ProjectShow(props: Props) {
    const { project, activities, members, siblings, defaultTaskDueDate } = props;
    const admin = usePage().props.auth.user!.is_admin;
    const templatesOn = !!usePage().props.features?.templates;

    const [editProject, setEditProject] = useState(false);
    const [activityModal, setActivityModal] = useState<{ open: boolean; activity?: Activity }>({ open: false });
    const [taskModal, setTaskModal] = useState<{ open: boolean; activityId?: number; task?: Task; key: number }>({ open: false, key: 0 });
    const [expenseModal, setExpenseModal] = useState<{ open: boolean; activityId?: number; expense?: Expense; key: number }>({ open: false, key: 0 });
    const initialTemplate = typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('template')) || undefined : undefined;
    const [tplModal, setTplModal] = useState<{ open: boolean; id?: number; key: number }>({ open: !!initialTemplate, id: initialTemplate, key: 1 });
    const [saveTpl, setSaveTpl] = useState(false);
    const [linesModal, setLinesModal] = useState(0);
    const hasTasks = activities.some((a) => a.tasks.length > 0);
    const closeTpl = () => {
        setTplModal((s) => ({ ...s, open: false }));
        if (initialTemplate) window.history.replaceState(window.history.state, '', window.location.pathname);
    };
    const [payModal, setPayModal] = useState<{ open: boolean; preset: string; key: number }>({ open: false, preset: 'advance', key: 0 });

    const f = props.financials;
    const firstUnpaid = props.plan?.find((p) => !p.paid)?.type ?? 'free';

    return (
        <AppLayout title={project.name}>
            <PageHeader
                back={{ href: '/projects', label: 'Projets' }}
                title={<span className="flex flex-wrap items-center gap-3">{project.name}<Badge tone={projectTone[project.status]}>{project.status_label}</Badge></span>}
                subtitle={
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                        {project.client && (admin ? <Link href={`/clients/${project.client.id}`} className="hover:underline">{project.client.name}</Link> : <span>{project.client.name}</span>)}
                        {project.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{project.location}</span>}
                        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />Projet {date(project.start_date)} → {date(project.delivery_date)}</span>
                        {project.event_date && <span className="inline-flex items-center gap-1">Événement {date(project.event_date)}</span>}
                    </span>
                }
                actions={
                    <>
                        {props.templates.length > 0 && <Button variant="secondary" onClick={() => setTplModal({ open: true, key: Date.now() })}><LayoutTemplate className="size-4" />Appliquer un modèle</Button>}
                        <Button onClick={() => setTaskModal({ open: true, key: Date.now() })}><Plus className="size-4" />Ajouter une tâche</Button>
                        {admin && (
                            <>
                                <Button variant="secondary" onClick={() => setPayModal({ open: true, preset: firstUnpaid, key: Date.now() })} disabled={project.status === 'cancelled' || f?.remaining === 0}><Receipt className="size-4" />Encaisser</Button>
                                <Button variant="ghost" onClick={() => setEditProject(true)} aria-label="Modifier le projet"><Pencil className="size-4" /></Button>
                                {hasTasks && templatesOn && <Button variant="ghost" onClick={() => setSaveTpl(true)} aria-label="Enregistrer comme modèle" title="Enregistrer comme modèle"><BookmarkPlus className="size-4" /></Button>}
                                <Button variant="ghost" aria-label="Archiver le projet" title="Archiver le projet" onClick={() => void confirmDialog({ title: 'Archiver ce projet', confirmLabel: 'Archiver le projet', message: <>« {project.name} », ses activités et ses tâches seront archivés. Un projet qui a déjà des paiements ne peut pas être archivé : passez-le plutôt en « Annulé ».</>, request: { method: 'delete', url: `/projects/${project.id}` } })}><Trash2 className="size-4" /></Button>
                            </>
                        )}
                    </>
                }
            />

            {project.notes && <p className="mb-6 rounded-xl bg-white p-4 text-sm whitespace-pre-line text-stone-600 ring-1 ring-stone-200/70">{project.notes}</p>}

            <HowItWorks
                id="project"
                title="Comment gérer un projet ?"
                steps={[
                    { title: 'Ajoutez les tâches', text: 'Pour chaque travail : quoi faire, qui s\'en occupe, pour quand. Rangez-les par activité (Photo, Vidéo, Album…).' },
                    { title: 'Enchaînez si besoin', text: 'Une tâche peut attendre une autre (la retouche attend le shooting). La personne est prévenue quand c\'est son tour.' },
                    { title: 'L\'équipe livre', text: 'Chacun commence sa tâche puis livre son travail. Vous l\'ouvrez et vous validez, ou vous la renvoyez avec un commentaire.' },
                    admin
                        ? { title: 'Encaissez', text: 'Enregistrez l\'acompte, la tranche et le solde : un reçu est créé à chaque fois, la facture à la fin.' }
                        : { title: 'Suivez l\'avancement', text: 'Les retards apparaissent en rouge. Le tableau de bord montre qui est chargé et qui est disponible.' },
                ]}
            />

            {admin && f && (
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 2xl:grid-cols-7">
                    <Stat label="Montant" value={fcfa(f.revenue)} />
                    <Stat label="Encaissé" value={fcfa(f.collected)} tone="positive" />
                    <Stat label="Reste à encaisser" value={fcfa(f.remaining)} tone={f.remaining ? 'warning' : undefined} />
                    <Stat label="Dépenses" value={fcfa(f.expenses)} />
                    <Stat label="Rému. versées" value={fcfa(f.fees_paid)} hint={`Prévues : ${fcfa(f.fees_planned)}${f.refunds ? ` · + ${fcfa(f.refunds)} remb. pénalités` : ''}`} />
                    <Stat label="Rému. à payer" value={fcfa(f.fees_due)} hint="Tâches validées, avant retenues" tone={f.fees_due ? 'warning' : undefined} />
                    <Stat label="Marge nette" value={fcfa(f.margin)} tone={f.margin >= 0 ? 'positive' : 'negative'} />
                </div>
            )}

            {admin && props.plan && (
                <div className="mb-6 grid gap-6 lg:grid-cols-5">
                    <Card title="Plan de paiement" className="lg:col-span-2" actions={props.invoice && <a href={`/invoices/${props.invoice.id}/pdf`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"><FileText className="size-3.5" />Facture {props.invoice.number}</a>}>
                        <ul className="space-y-2">
                            {props.plan.map((p) => (
                                <li key={p.type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ring-stone-100">
                                    <div>
                                        <p className="text-sm font-medium">{p.label}</p>
                                        <p className="tabular text-xs text-stone-500">{fcfa(p.amount)}</p>
                                    </div>
                                    {p.paid ? <Badge tone="green">Encaissée</Badge> : (
                                        <Button size="sm" variant="secondary" disabled={project.status === 'cancelled'} onClick={() => setPayModal({ open: true, preset: p.type, key: Date.now() })}>Encaisser</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Détail de la facture</p>
                                <p className="text-xs text-stone-500">{f?.client_shares ? `${fcfa(f.client_shares)} détaillés sur ${fcfa(f.revenue)}` : 'Montant global, sans détail par prestation'}</p>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setLinesModal(Date.now())} disabled={!hasTasks} title={hasTasks ? undefined : 'Ajoutez d\'abord des tâches'}><ListChecks className="size-3.5" />{f?.client_shares ? 'Modifier' : 'Détailler'}</Button>
                        </div>
                    </Card>
                    <Card title={`Encaissements (${props.payments?.length ?? 0})`} className="lg:col-span-3">
                        {!props.payments?.length ? <Empty title="Aucun encaissement pour ce projet." /> : (
                            <Table>
                                <thead><tr><Th>Reçu</Th><Th>Tranche</Th><Th>Moyen</Th><Th className="text-right">Montant</Th><Th /></tr></thead>
                                <tbody>
                                    {props.payments.map((p) => (
                                        <tr key={p.id}>
                                            <Td><p className="font-mono text-xs">{p.receipt_number}</p><p className="text-xs text-stone-500">{dateTime(p.paid_at)} · {p.recorded_by}</p></Td>
                                            <Td>{p.type_label}</Td>
                                            <Td className="text-stone-600">{p.method_label}{p.reference && <p className="text-xs text-stone-500">{p.reference}</p>}</Td>
                                            <Td className="tabular text-right font-medium">{fcfa(p.amount)}</Td>
                                            <Td><a href={`/client-payments/${p.id}/receipt`} title="Télécharger le reçu PDF" className="text-stone-400 hover:text-stone-900"><Download className="size-4" /></a></Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        )}
                    </Card>
                </div>
            )}

            <div className="space-y-6">
                {activities.length === 0 ? (
                    <Card>
                        <Empty icon={<ListChecks className="size-10" />} title="Aucune tâche pour l'instant">
                            Commencez par dire qui fait quoi : par exemple « Couverture photo » pour le photographe, puis « Retouche » pour le retoucheur.
                            <div className="mt-4 flex flex-wrap justify-center gap-2">
                                <Button onClick={() => setTaskModal({ open: true, key: Date.now() })}><Plus className="size-4" />Ajouter la première tâche</Button>
                                {props.templates.length > 0 && <Button variant="secondary" onClick={() => setTplModal({ open: true, key: Date.now() })}><LayoutTemplate className="size-4" />Partir d'un modèle</Button>}
                            </div>
                        </Empty>
                    </Card>
                ) : (
                    activities.map((a) => (
                        <ActivityCard
                            key={a.id}
                            activity={a}
                            admin={admin}
                            onEdit={() => setActivityModal({ open: true, activity: a })}
                            onAddTask={() => setTaskModal({ open: true, activityId: a.id, key: Date.now() })}
                            onEditTask={(t) => setTaskModal({ open: true, task: t, key: Date.now() })}
                            onAddExpense={() => setExpenseModal({ open: true, activityId: a.id, key: Date.now() })}
                            onEditExpense={(e) => setExpenseModal({ open: true, expense: e, key: Date.now() })}
                        />
                    ))
                )}
            </div>

            {admin && props.memberPayments && props.memberPayments.length > 0 && (
                <Card title="Rémunérations versées" className="mt-6">
                    <Table>
                        <thead><tr><Th>Reçu</Th><Th>Membre</Th><Th>Tâche</Th><Th className="text-right">Brut</Th><Th className="text-right">Retenue</Th><Th className="text-right">Net</Th><Th /></tr></thead>
                        <tbody>
                            {props.memberPayments.map((p) => (
                                <tr key={p.id}>
                                    <Td><p className="font-mono text-xs">{p.receipt_number}</p><p className="text-xs text-stone-500">{dateTime(p.paid_at)}</p></Td>
                                    <Td>{p.member}</Td>
                                    <Td>{p.task && <Link href={`/tasks/${p.task.id}`} className="hover:underline">{p.task.name}</Link>}</Td>
                                    <Td className="tabular text-right">{fcfa(p.gross_amount)}</Td>
                                    <Td className="tabular text-right text-red-600">{p.penalty_deducted ? `− ${fcfa(p.penalty_deducted)}` : '—'}</Td>
                                    <Td className="tabular text-right font-medium">{fcfa(p.net_amount)}</Td>
                                    <Td><a href={`/member-payments/${p.id}/receipt`} className="text-stone-400 hover:text-stone-900" title="Reçu PDF"><Download className="size-4" /></a></Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card>
            )}

            <ActivityModal key={activityModal.activity?.id ?? 'new'} open={activityModal.open} onClose={() => setActivityModal({ open: false })} projectId={project.id} activity={activityModal.activity} />
            <TaskFormModal key={`t${taskModal.key}`} open={taskModal.open} onClose={() => setTaskModal((s) => ({ ...s, open: false }))} projectId={project.id} activities={activities} activityId={taskModal.activityId} task={taskModal.task} members={members} siblings={siblings} defaultDueDate={defaultTaskDueDate} minDate={project.start_date} maxDate={project.delivery_date} />
            <ApplyTemplateModal key={`tpl${tplModal.key}`} open={tplModal.open} onClose={closeTpl} projectId={project.id} templates={props.templates} members={members} initialId={tplModal.id} isAdmin={admin} hasTasks={hasTasks} shareLeft={props.shareLeft} startDate={project.start_date} deliveryDate={project.delivery_date} />
            {admin && (
                <>
                    {linesModal > 0 && <InvoiceLinesModal key={linesModal} open onClose={() => setLinesModal(0)} projectId={project.id} total={project.total_amount ?? 0} activities={activities} />}
                    {saveTpl && <SaveTemplateModal projectId={project.id} projectName={project.name} onClose={() => setSaveTpl(false)} />}
                    <ExpenseModal key={`e${expenseModal.key}`} open={expenseModal.open} onClose={() => setExpenseModal((s) => ({ ...s, open: false }))} activityId={expenseModal.activityId} expense={expenseModal.expense} />
                    {props.plan && props.methods && (
                        <PaymentModal key={`p${payModal.key}`} open={payModal.open} onClose={() => setPayModal((s) => ({ ...s, open: false }))} project={project} plan={props.plan} methods={props.methods} preset={payModal.preset} remaining={props.financials?.remaining ?? 0} />
                    )}
                    {props.clients && <ProjectFormModal open={editProject} onClose={() => setEditProject(false)} project={project} clients={props.clients} statuses={props.statuses} />}
                </>
            )}
        </AppLayout>
    );
}
