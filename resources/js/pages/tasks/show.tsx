import { Link, useForm, usePage } from '@inertiajs/react';
import { CheckCircle2, Download, ExternalLink, Gavel, Hourglass, Link2, Lock, Pencil, Play, RotateCcw, Send, Upload, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { CancelPenaltyModal } from '@/components/cancel-penalty-modal';
import { DueChip } from '@/components/task-list';
import { TaskFormModal } from '@/components/task-form';
import { Badge, Button, Card, Empty, Field, Input, Modal, MoneyInput, PageHeader, Select, Stat, TaskStatusBadge, Textarea, formErrorBanner } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Member, Option, SiblingTask, Task } from '@/types';

function StartCard({ task, onDeliverNow }: { task: Task; onDeliverNow: () => void }) {
    const form = useForm({});
    return (
        <Card title={<span className="flex items-center gap-2"><Play className="size-4 text-brand-600" />Prêt à commencer ?</span>}>
            <p className="mb-4 text-sm text-stone-600">Appuyez sur « Commencer » quand vous attaquez ce travail : l'équipe voit qui est dessus. Une fois fini, vous le livrerez ici.</p>
            <div className="flex flex-wrap gap-2">
                <Button loading={form.processing} onClick={() => form.post(`/tasks/${task.id}/start`, { preserveScroll: true })}><Play className="size-4" />Commencer</Button>
                <Button variant="ghost" onClick={onDeliverNow}>Déjà terminé ? Livrer maintenant</Button>
            </div>
        </Card>
    );
}

function DeliverCard({ task }: { task: Task }) {
    const form = useForm({ proof_url: '', proof_note: '' });
    const last = task.reviews?.find((r) => r.action !== 'started');
    const returned = last?.action === 'returned' ? last : null;
    return (
        <Card title={<span className="flex items-center gap-2"><Upload className="size-4 text-brand-600" />{returned ? 'Livrer la version corrigée' : 'Livrer mon travail'}</span>}>
            {returned && (
                <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
                    <p className="font-semibold">Corrections demandées par {returned.user} — {dateTime(returned.created_at)}</p>
                    {returned.comment && <p className="mt-1"><strong>Motif :</strong> {returned.comment}</p>}
                    {returned.corrections && <p className="mt-1 whitespace-pre-line">{returned.corrections}</p>}
                </div>
            )}
            <p className="mb-4 text-sm text-stone-600">
                Dites à l'admin <strong>où trouver le travail</strong> pour qu'il le contrôle{(task.dependents?.length ?? 0) > 0 ? ' et que la personne de l\'étape suivante récupère les fichiers' : ''}.
            </p>
            <form noValidate
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(`/tasks/${task.id}/submit`, { preserveScroll: true, onSuccess: () => form.reset() });
                }}
            >
                <Field label="Lien vers les fichiers" error={form.errors.proof_url} hint="Collez le lien de partage : Google Drive, WeTransfer, Dropbox, YouTube non répertoriée…">
                    <Input type="url" inputMode="url" value={form.data.proof_url} onChange={(e) => form.setData('proof_url', e.target.value)} placeholder="https://…" />
                </Field>
                <Field label={form.data.proof_url ? 'Message (facultatif)' : 'Message'} error={form.errors.proof_note} hint={form.data.proof_url ? undefined : 'Pas de lien ? Expliquez où sont les fichiers (ex. « copiés sur le disque du studio, dossier Mariage Ngo »).'}>
                    <Textarea rows={2} value={form.data.proof_note} onChange={(e) => form.setData('proof_note', e.target.value)} placeholder="Nombre de fichiers, remarques…" />
                </Field>
                <Button type="submit" loading={form.processing} className="w-full sm:w-auto"><Send className="size-4" />Livrer pour vérification</Button>
                {task.is_late && <p className="text-xs text-red-600">Cette tâche est en retard : la livraison arrête le décompte des pénalités.</p>}
            </form>
        </Card>
    );
}

/** Previous step (what this task waits for) and next step (who waits for this one). */
function ChainCard({ task, isOwner }: { task: Task; isOwner: boolean }) {
    const dep = task.dependency;
    const next = task.dependents ?? [];
    if (!dep && next.length === 0) return null;
    return (
        <Card title={<span className="flex items-center gap-2"><Link2 className="size-4 text-stone-500" />Enchaînement</span>}>
            {dep && (
                <div className={cn('rounded-xl p-4 text-sm ring-1', task.is_waiting ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-stone-50 text-stone-700 ring-stone-200/70')}>
                    <p className="text-xs font-medium tracking-wide uppercase opacity-70">Étape précédente</p>
                    <p className="mt-1">
                        <Link href={`/tasks/${dep.id}`} className="font-semibold hover:underline">« {dep.name} »</Link>
                        {dep.assignee ? ` — ${dep.assignee}` : ''} · {dep.status_label}
                    </p>
                    {task.is_waiting ? (
                        <p className="mt-2 flex items-start gap-2"><Hourglass className="mt-0.5 size-4 shrink-0" />
                            {isOwner ? 'Vous pourrez commencer dès qu\'elle sera validée : vous serez prévenu. Pas de pénalité tant que vous attendez.' : 'Cette tâche démarrera quand elle sera validée. Pas de pénalité pendant l\'attente.'}
                        </p>
                    ) : dep.delivery_url || dep.delivery_note ? (
                        <div className="mt-2">
                            <p className="font-medium">Fichiers de départ</p>
                            {dep.delivery_url && <a href={dep.delivery_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 break-all text-sky-700 hover:underline"><ExternalLink className="size-4 shrink-0" />{dep.delivery_url}</a>}
                            {dep.delivery_note && <p className="mt-1 whitespace-pre-line text-stone-600">« {dep.delivery_note} »</p>}
                        </div>
                    ) : null}
                </div>
            )}
            {next.length > 0 && (
                <div className={cn('text-sm text-stone-600', dep && 'mt-4')}>
                    <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Étape suivante</p>
                    <ul className="mt-1 space-y-1">
                        {next.map((n) => (
                            <li key={n.id}><Link href={`/tasks/${n.id}`} className="font-medium text-stone-900 hover:underline">« {n.name} »</Link>{n.assignee ? ` — ${n.assignee}` : ''} · {n.status_label}</li>
                        ))}
                    </ul>
                    {task.status !== 'done' && <p className="mt-2 text-xs text-stone-500">{next.length > 1 ? 'Ces personnes attendent' : 'Cette personne attend'} que ce travail soit validé pour commencer.</p>}
                </div>
            )}
        </Card>
    );
}

function ReviewCard({ task }: { task: Task }) {
    const [mode, setMode] = useState<'none' | 'validate' | 'return'>('none');
    const validate = useForm({ comment: '' });
    const ret = useForm({ comment: '', corrections: '' });

    return (
        <Card title="Contrôler le travail livré" className="ring-2 ring-sky-200">
            <p className="mb-3 text-sm text-stone-600">{task.assignee?.name} a livré ce travail{task.submitted_at ? ` le ${dateTime(task.submitted_at)}` : ''}. Vérifiez-le, puis validez-le ou renvoyez-le avec ce qu'il faut corriger.</p>
            {task.proof_url && (
                <a href={task.proof_url} target="_blank" rel="noreferrer" className="mb-4 flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium break-all text-sky-800 hover:bg-sky-100">
                    <ExternalLink className="size-4 shrink-0" />Ouvrir les fichiers · <span className="font-normal">{task.proof_url}</span>
                </a>
            )}
            {task.proof_note && <p className="mb-4 text-sm whitespace-pre-line text-stone-600">« {task.proof_note} »</p>}
            {mode === 'none' && (
                <div className="flex flex-wrap gap-2">
                    <Button variant="success" onClick={() => setMode('validate')}><CheckCircle2 className="size-4" />Valider</Button>
                    <Button variant="secondary" onClick={() => setMode('return')}><RotateCcw className="size-4" />Renvoyer avec corrections</Button>
                </div>
            )}
            {mode === 'validate' && (
                <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); validate.post(`/tasks/${task.id}/validate`, { preserveScroll: true }); }}>
                    <Field label="Commentaire (facultatif)">
                        <Textarea rows={2} value={validate.data.comment} onChange={(e) => validate.setData('comment', e.target.value)} />
                    </Field>
                    <p className="text-xs text-stone-500">La tâche sera terminée et verrouillée{(task.dependents?.length ?? 0) > 0 ? ' ; l\'étape suivante pourra commencer et recevra ces fichiers' : ''}.</p>
                    <div className="flex gap-2">
                        <Button type="submit" variant="success" loading={validate.processing}>Confirmer la validation</Button>
                        <Button variant="ghost" onClick={() => setMode('none')}>Annuler</Button>
                    </div>
                </form>
            )}
            {mode === 'return' && (
                <form noValidate className="space-y-3" onSubmit={(e) => { e.preventDefault(); ret.post(`/tasks/${task.id}/return`, { preserveScroll: true }); }}>
                    <Field label="Motif du renvoi" error={ret.errors.comment}>
                        <Textarea rows={2} value={ret.data.comment} onChange={(e) => ret.setData('comment', e.target.value)} />
                    </Field>
                    <Field label="Corrections demandées" error={ret.errors.corrections}>
                        <Textarea rows={3} value={ret.data.corrections} onChange={(e) => ret.setData('corrections', e.target.value)} />
                    </Field>
                    <div className="flex gap-2">
                        <Button type="submit" variant="danger" loading={ret.processing}>Renvoyer au membre</Button>
                        <Button variant="ghost" onClick={() => setMode('none')}>Annuler</Button>
                    </div>
                </form>
            )}
        </Card>
    );
}

function PayModal({ open, onClose, task, methods, debt }: { open: boolean; onClose: () => void; task: Task; methods: Option[]; debt: number }) {
    const form = useForm({ amount: (task.remaining_fee ?? '') as number | '', method: 'mobile_money', reference: '', note: '' });
    const gross = Number(form.data.amount || 0);
    const withheld = Math.min(gross, debt);
    const submit = () => {
        form.transform((d) => ({ ...d, amount: Number(d.amount || 0) }));
        form.post(`/tasks/${task.id}/payments`, { preserveScroll: true, onSuccess: onClose });
    };
    return (
        <Modal
            open={open}
            onClose={onClose}
            onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)}
            title={`Payer ${task.assignee?.name ?? ''}`}
            description={`Tâche « ${task.name} »`}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>
                        Verser {fcfa(gross - withheld)}
                    </Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Montant brut" error={form.errors.amount} className="sm:col-span-2" hint={`Reste dû sur cette tâche : ${fcfa(task.remaining_fee)}. Vous pouvez payer en plusieurs tranches.`}>
                    <MoneyInput value={form.data.amount} onChange={(v) => form.setData('amount', v)} />
                </Field>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-200/70 sm:col-span-2">
                    <div><p className="text-[11px] text-stone-500 uppercase">Brut</p><p className="tabular text-sm font-semibold">{fcfa(gross)}</p></div>
                    <div><p className="text-[11px] text-stone-500 uppercase">Pénalité retenue</p><p className="tabular text-sm font-semibold text-red-600">− {fcfa(withheld)}</p></div>
                    <div><p className="text-[11px] text-stone-500 uppercase">Net versé</p><p className="tabular text-sm font-semibold text-emerald-700">{fcfa(gross - withheld)}</p></div>
                </div>
                {debt > 0 && <p className="text-xs text-stone-500 sm:col-span-2">{task.assignee?.name} doit actuellement {fcfa(debt)} de pénalités : elles sont retenues automatiquement.</p>}
                <Field label="Moyen" error={form.errors.method}>
                    <Select value={form.data.method} onChange={(e) => form.setData('method', e.target.value)}>
                        {methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </Select>
                </Field>
                <Field label="Référence" error={form.errors.reference}>
                    <Input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} />
                </Field>
                <Field label="Note" error={form.errors.note} className="sm:col-span-2">
                    <Textarea rows={2} value={form.data.note} onChange={(e) => form.setData('note', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}

function Lifecycle({ task, isOwner, isAdmin }: { task: Task; isOwner: boolean; isAdmin: boolean }) {
    const steps = [
        { key: 'todo', label: 'À faire' },
        { key: 'in_progress', label: 'En cours' },
        { key: 'review', label: 'À vérifier' },
        { key: 'done', label: 'Terminée' },
    ];
    const current = steps.findIndex((s) => s.key === task.status);
    const returned = task.status === 'in_progress' && task.reviews?.find((r) => r.action !== 'started')?.action === 'returned';
    const who = task.assignee?.name ?? 'le membre';
    const next = task.is_waiting
        ? `En attente : démarre quand « ${task.dependency?.name} » sera validée.`
        : task.status === 'todo'
          ? isOwner ? 'Appuyez sur « Commencer » quand vous attaquez ce travail.' : `${who} n'a pas encore commencé.`
          : task.status === 'in_progress'
            ? isOwner
                ? returned ? 'Corrigez selon les remarques ci-dessous, puis livrez de nouveau.' : 'Une fois fini, livrez votre travail ci-dessous.'
                : returned ? `${who} corrige le travail.` : `${who} travaille dessus.`
            : task.status === 'review'
              ? isAdmin ? 'Ouvrez le travail livré, puis validez ou renvoyez avec les corrections.' : "Livré : en attente du contrôle de l'administrateur."
              : 'Tâche validée et verrouillée.';
    return (
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70">
            <ol className="flex items-center gap-2">
                {steps.map((s, i) => {
                    const done = i < current || task.status === 'done';
                    return (
                        <li key={s.key} className={cn('flex items-center gap-2', i < steps.length - 1 && 'flex-1')}>
                            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-emerald-600 text-white' : i === current ? (task.is_waiting ? 'bg-stone-300 text-white' : 'bg-ink text-white') : 'bg-stone-100 text-stone-400')}>
                                {done ? <CheckCircle2 className="size-4" /> : i + 1}
                            </span>
                            <span className={cn('hidden text-sm whitespace-nowrap md:inline', i === current ? 'font-semibold text-stone-900' : 'text-stone-500')}>{s.label}</span>
                            {i < steps.length - 1 && <span className={cn('h-0.5 flex-1 rounded-full', i < current ? 'bg-emerald-600' : 'bg-stone-200')} />}
                        </li>
                    );
                })}
            </ol>
            <p className="mt-3 text-sm text-stone-600">
                <span className="font-medium text-stone-900 md:hidden">{task.is_waiting ? 'En attente' : steps[current]?.label} · </span>
                {returned && <Badge tone="red" className="mr-2">Renvoyée</Badge>}
                {next}
            </p>
        </div>
    );
}

const reviewMeta = {
    started: { label: 'Commencée', tone: 'violet' as const, icon: Play },
    submitted: { label: 'Travail livré', tone: 'blue' as const, icon: Send },
    validated: { label: 'Validée', tone: 'green' as const, icon: CheckCircle2 },
    returned: { label: 'Renvoyée', tone: 'red' as const, icon: RotateCcw },
};

export default function TaskShow({ task, methods, penaltyDebt, members, siblings, dateBounds }: { task: Task; methods: Option[]; penaltyDebt: number | null; members: Member[]; siblings: SiblingTask[]; dateBounds: { start: string; end: string } }) {
    const user = usePage().props.auth.user!;
    const isOwner = task.assignee?.id === user.id;
    const [edit, setEdit] = useState(false);
    const [deliverNow, setDeliverNow] = useState(false);
    const [pay, setPay] = useState(0);
    const showMoney = task.member_fee !== undefined;
    const [cancel, setCancel] = useState<{ ids: number[]; total: number; label: string } | null>(null);
    const activePenalties = (task.penalties ?? []).filter((p) => !p.cancelled_at);
    const penaltiesTotal = activePenalties.reduce((s, p) => s + p.amount, 0);

    return (
        <AppLayout title={task.name}>
            <PageHeader
                back={user.is_staff && task.project ? { href: `/projects/${task.project.id}`, label: task.project.name } : { href: '/tasks', label: 'Mes tâches' }}
                title={task.name}
                subtitle={
                    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <TaskStatusBadge status={task.status} label={task.status_label} late={task.is_late} waiting={task.is_waiting} />
                        <span>{task.project?.name} · {task.activity?.name}</span>
                        <DueChip task={task} />
                    </span>
                }
                actions={
                    <>
                        {task.status === 'done' && <Badge tone="green"><Lock className="size-3" />Verrouillée</Badge>}
                        {user.is_staff && (user.is_admin || task.status !== 'done') && <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" />Modifier</Button>}
                        {user.is_admin && task.assignee && (task.remaining_fee ?? 0) > 0 && <Button onClick={() => setPay(Date.now())}><Wallet className="size-4" />Payer le membre</Button>}
                    </>
                }
            />

            <Lifecycle task={task} isOwner={isOwner} isAdmin={user.is_admin} />

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Card title="Instructions">
                        {task.instructions ? <p className="text-sm leading-relaxed whitespace-pre-line text-stone-700">{task.instructions}</p> : <p className="text-sm text-stone-400">Aucune instruction particulière.</p>}
                        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4 text-sm sm:grid-cols-3">
                            <div><dt className="text-xs text-stone-500">Assignée à</dt><dd className="font-medium">{task.assignee?.name ?? '—'}</dd></div>
                            <div><dt className="text-xs text-stone-500">Date de livraison</dt><dd className="font-medium">{date(task.due_date)}</dd></div>
                            {task.started_at && <div><dt className="text-xs text-stone-500">Commencée le</dt><dd>{dateTime(task.started_at)}</dd></div>}
                            {task.submitted_at && <div><dt className="text-xs text-stone-500">Dernière livraison</dt><dd>{dateTime(task.submitted_at)}</dd></div>}
                            {task.validated_at && <div><dt className="text-xs text-stone-500">Validée le</dt><dd>{dateTime(task.validated_at)}</dd></div>}
                        </dl>
                    </Card>

                    <ChainCard task={task} isOwner={isOwner} />
                    {isOwner && !task.is_waiting && task.status === 'todo' && !deliverNow && <StartCard task={task} onDeliverNow={() => setDeliverNow(true)} />}
                    {isOwner && !task.is_waiting && (task.status === 'in_progress' || (task.status === 'todo' && deliverNow)) && <DeliverCard task={task} />}
                    {isOwner && task.status === 'review' && (
                        <Card><p className="flex items-center gap-2 text-sm text-sky-800"><Send className="size-4" />Votre travail est livré : l'administrateur va le vérifier. Vous serez prévenu.</p></Card>
                    )}
                    {user.is_admin && task.status === 'review' && <ReviewCard task={task} />}
                    {!user.is_admin && !isOwner && task.status === 'review' && task.proof_url && (
                        <Card title="Travail livré"><a href={task.proof_url} target="_blank" rel="noreferrer" className="text-sm break-all text-sky-700 hover:underline">{task.proof_url}</a></Card>
                    )}

                    <Card title="Historique">
                        {!task.reviews?.length ? <Empty title="Rien pour l'instant." /> : (
                            <ol className="relative space-y-5 border-l border-stone-200 pl-6">
                                {task.reviews.map((r) => {
                                    const meta = reviewMeta[r.action];
                                    return (
                                        <li key={r.id} className="relative">
                                            <span className={cn('absolute top-0.5 -left-[33px] flex size-5 items-center justify-center rounded-full bg-white ring-2', r.action === 'validated' ? 'text-emerald-600 ring-emerald-200' : r.action === 'returned' ? 'text-red-600 ring-red-200' : r.action === 'started' ? 'text-violet-600 ring-violet-200' : 'text-sky-600 ring-sky-200')}>
                                                <meta.icon className="size-3" />
                                            </span>
                                            <p className="flex flex-wrap items-center gap-2 text-sm"><Badge tone={meta.tone}>{meta.label}</Badge><span className="text-stone-500">{dateTime(r.created_at)} · {r.user}</span></p>
                                            {r.proof_url && <a href={r.proof_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm break-all text-sky-700 hover:underline">{r.proof_url}</a>}
                                            {r.comment && <p className="mt-1 text-sm whitespace-pre-line text-stone-700">{r.action === 'returned' ? <strong>Motif : </strong> : null}{r.comment}</p>}
                                            {r.corrections && <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-800"><strong>Corrections : </strong>{r.corrections}</p>}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </Card>
                </div>

                <div className="space-y-6">
                    {showMoney && (
                        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                            <Stat label="Rémunération" value={fcfa(task.member_fee)} hint={user.is_admin && task.client_share ? `Sur la facture client : ${fcfa(task.client_share)}` : undefined} />
                            <Stat label="Déjà versé (brut)" value={fcfa(task.paid_gross)} hint={`Reste dû : ${fcfa(task.remaining_fee)}`} tone={task.remaining_fee ? 'warning' : 'positive'} />
                        </div>
                    )}

                    {(task.penalties?.length ?? 0) > 0 && (
                        <Card title={<span className="flex items-center gap-2"><Gavel className="size-4 text-red-600" />Pénalités de retard</span>} actions={<span className="tabular text-sm font-semibold text-red-600">{fcfa(penaltiesTotal)}</span>}>
                            <ul className="space-y-2.5 text-sm">
                                {task.penalties!.map((p) => (
                                    <li key={p.id}>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={p.cancelled_at ? 'text-stone-400 line-through' : 'text-stone-600'}>#{p.period} · {dateTime(p.accrued_at)}</span>
                                            <span className="flex items-center gap-2">
                                                <span className={`tabular font-medium ${p.cancelled_at ? 'text-stone-400 line-through' : ''}`}>{fcfa(p.amount)}</span>
                                                {user.is_admin && !p.cancelled_at && (
                                                    <button type="button" title="Annuler cette pénalité" aria-label="Annuler cette pénalité" className="rounded p-0.5 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => setCancel({ ids: [p.id], total: p.amount, label: `Pénalité n°${p.period} de ${task.assignee?.name ?? ''}` })}>
                                                        <X className="size-3.5" />
                                                    </button>
                                                )}
                                            </span>
                                        </div>
                                        {p.cancelled_at && <p className="mt-0.5 text-xs text-stone-500">Annulée le {dateTime(p.cancelled_at)} par {p.cancelled_by} — « {p.cancel_reason} »</p>}
                                    </li>
                                ))}
                            </ul>
                            {user.is_admin && activePenalties.length > 1 && (
                                <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={() => setCancel({ ids: activePenalties.map((p) => p.id), total: penaltiesTotal, label: `Toutes les pénalités de ${task.assignee?.name ?? ''} sur cette tâche` })}>
                                    Annuler toutes les pénalités
                                </Button>
                            )}
                            <p className="mt-3 text-xs text-stone-500">Les pénalités comptées restent dues, même si l'échéance est repoussée{user.is_admin ? ', sauf annulation par l\'admin avec motif' : ''}.</p>
                        </Card>
                    )}

                    {showMoney && (
                        <Card title="Versements">
                            {!task.payments?.length ? <Empty title="Aucun versement." /> : (
                                <ul className="-my-1 divide-y divide-stone-100">
                                    {task.payments.map((p) => (
                                        <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                                            <div className="min-w-0 text-sm">
                                                <p className="tabular font-medium text-emerald-700">{fcfa(p.net_amount)} <span className="text-xs font-normal text-stone-500">net</span></p>
                                                <p className="text-xs text-stone-500">Brut {fcfa(p.gross_amount)}{p.penalty_deducted ? ` · retenue ${fcfa(p.penalty_deducted)}` : ''}</p>
                                                <p className="text-xs text-stone-500">{dateTime(p.paid_at)} · {p.method_label}</p>
                                            </div>
                                            <a href={`/member-payments/${p.id}/receipt`} className="text-stone-400 hover:text-stone-900" title={`Reçu ${p.receipt_number}`}><Download className="size-4" /></a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    )}

                    {user.is_staff && task.project && (
                        <Link href={`/projects/${task.project.id}`} className="block text-center text-sm text-stone-500 hover:text-stone-900">Voir le projet →</Link>
                    )}
                </div>
            </div>

            {user.is_staff && <TaskFormModal key={`edit-${edit}`} open={edit} onClose={() => setEdit(false)} task={task} members={members} siblings={siblings} minDate={dateBounds.start} maxDate={dateBounds.end} />}
            {cancel && <CancelPenaltyModal {...cancel} debt={penaltyDebt ?? 0} methods={methods} onClose={() => setCancel(null)} />}
            {user.is_admin && pay > 0 && <PayModal key={pay} open onClose={() => setPay(0)} task={task} methods={methods} debt={penaltyDebt ?? 0} />}
        </AppLayout>
    );
}
