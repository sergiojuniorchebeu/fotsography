import { Link } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Coins, Gavel, Hourglass, Link2, PiggyBank, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { MonthlyChart, StatusBars } from '@/components/finance-chart';
import { TaskList } from '@/components/task-list';
import { Badge, ButtonLink, Card, Empty, HowItWorks, PageHeader, Progress, Stat, Table, Td, Th, projectTone } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import { workloadLabel } from '@/components/task-form';
import type { ClientPayment, FinanceSummary, Member, MemberStat, MonthPoint, Project, Task } from '@/types';

type Counts = { todo: number; in_progress?: number; waiting: number; review: number; done: number; late: number };

type StaffProps = {
    role: 'admin' | 'super_admin' | 'assistant';
    taskCounts: Counts;
    workload: Member[];
    toReview: Task[];
    upcoming: Task[];
    late: Task[];
    projects: Project[];
    summary?: FinanceSummary;
    monthly?: MonthPoint[];
    members?: MemberStat[];
    recentPayments?: ClientPayment[];
    setup?: { key: string; label: string; text: string; href: string; done: boolean }[];
};

type MemberProps = {
    role: string;
    myTasks: Task[];
    taskCounts: Counts;
    earnings: { fees_total: number; net_paid: number; remaining: number; penalty_debt: number };
};

function TaskCountStats({ c }: { c: Counts }) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="En cours" value={c.todo + (c.in_progress ?? 0)} hint={`${c.in_progress ?? 0} commencée(s) · ${c.waiting} en attente`} icon={<Clock className="size-4" />} />
            <Stat label="À vérifier" value={c.review} icon={<ClipboardCheck className="size-4" />} />
            <Stat label="Terminées" value={c.done} icon={<CheckCircle2 className="size-4" />} />
            <Stat label="En retard" value={c.late} tone={c.late > 0 ? 'negative' : undefined} icon={<AlertTriangle className="size-4" />} />
        </div>
    );
}

function ProjectsProgress({ projects, admin }: { projects: Project[]; admin: boolean }) {
    if (projects.length === 0) {
        return <Empty title="Aucun projet en cours." />;
    }
    return (
        <ul className="-my-2 divide-y divide-stone-100">
            {projects.map((p) => (
                <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="-mx-2 block rounded-lg px-2 py-2.5 hover:bg-stone-50">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{p.name}</p>
                                <p className="truncate text-xs text-stone-500">
                                    {p.client?.name} · livraison {date(p.delivery_date)}
                                    {admin && p.total_amount !== undefined ? ` · ${fcfa(p.total_amount)}` : ''}
                                </p>
                            </div>
                            <Badge tone={projectTone[p.status]} className="shrink-0">{p.status_label}</Badge>
                        </div>
                        <div className="mt-2">
                            <Progress value={p.tasks_done ?? 0} max={p.tasks_total ?? 0} />
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function SetupChecklist({ steps }: { steps: NonNullable<StaffProps['setup']> }) {
    const done = steps.filter((s) => s.done).length;
    const next = steps.find((s) => !s.done);
    return (
        <Card title={`Bien démarrer : ${done} étape(s) sur ${steps.length}`} className="mb-6 ring-brand-200">
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {steps.map((step, i) => {
                    const current = step === next;
                    return (
                        <li key={step.key}>
                            <Link href={step.href} className={`flex h-full gap-3 rounded-xl p-3 ring-1 transition ${step.done ? 'ring-stone-100' : current ? 'bg-brand-50/70 ring-brand-300 hover:ring-brand-400' : 'ring-stone-200 hover:bg-stone-50'}`}>
                                {step.done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${current ? 'bg-brand-500 text-white' : 'border border-stone-300 text-stone-500'}`}>{i + 1}</span>}
                                <span className="min-w-0">
                                    <span className={`block text-sm ${step.done ? 'text-stone-400 line-through' : 'font-medium text-stone-900'}`}>{step.label}</span>
                                    {!step.done && <span className="mt-0.5 block text-xs text-stone-500">{step.text}</span>}
                                    {current && <span className="mt-1.5 block text-xs font-medium text-brand-700">C'est la prochaine étape →</span>}
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ol>
        </Card>
    );
}

function TeamLoad({ members }: { members: Member[] }) {
    if (members.length === 0) return <Empty title="Aucun membre pour l'instant." />;
    const max = Math.max(1, ...members.map((m) => (m.open_count ?? 0) + (m.review_count ?? 0)));
    return (
        <ul className="-my-1 space-y-2.5">
            {members.map((m) => {
                const open = m.open_count ?? 0;
                const review = m.review_count ?? 0;
                return (
                    <li key={m.id}>
                        <Link href={`/tasks?member=${m.id}`} className="-mx-2 block rounded-lg px-2 py-1 hover:bg-stone-50">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="truncate font-medium">{m.name} <span className="text-xs font-normal text-stone-500">{m.role_label}</span></span>
                                <span className={`shrink-0 text-xs ${m.late_count ? 'font-medium text-red-600' : 'text-stone-500'}`}>{workloadLabel(m)}</span>
                            </div>
                            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-stone-100">
                                <span className="bg-violet-500" style={{ width: `${(open / max) * 100}%` }} />
                                <span className="bg-sky-400" style={{ width: `${(review / max) * 100}%` }} />
                            </div>
                        </Link>
                    </li>
                );
            })}
            <li className="flex gap-4 pt-1 text-[11px] text-stone-500">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-violet-500" />À faire / en cours</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-sky-400" />Livré, à vérifier</span>
            </li>
        </ul>
    );
}

function StaffDashboard(props: StaffProps) {
    const admin = props.role === 'admin' || props.role === 'super_admin';
    const s = props.summary;

    return (
        <AppLayout title="Tableau de bord">
            <PageHeader
                title="Tableau de bord"
                subtitle={admin ? 'Vue d\'ensemble du studio : argent, projets et équipe.' : 'Avancement des projets et des tâches.'}
                actions={admin ? <ButtonLink href="/finances" variant="secondary">Voir les finances</ButtonLink> : undefined}
            />

            {admin && props.setup && props.setup.some((step) => !step.done) && <SetupChecklist steps={props.setup} />}

            {admin && s && (
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat label="Chiffre d'affaires" value={fcfa(s.revenue)} hint="Projets non annulés" icon={<TrendingUp className="size-4" />} />
                    <Stat label="Encaissé" value={fcfa(s.collected)} tone="positive" hint={`Reste à encaisser : ${fcfa(s.remaining)}`} icon={<Wallet className="size-4" />} />
                    <Stat label="Dépenses + rémunérations" value={fcfa(s.expenses + s.fees_paid)} hint={`Dépenses ${fcfa(s.expenses)} · Rému. ${fcfa(s.fees_paid)}`} icon={<Coins className="size-4" />} />
                    <Stat label="Marge nette" value={fcfa(s.margin)} tone={s.margin >= 0 ? 'positive' : 'negative'} hint="Encaissé − dépenses − sommes versées aux membres" icon={<PiggyBank className="size-4" />} />
                </div>
            )}

            <div className="mb-6">
                <TaskCountStats c={props.taskCounts} />
            </div>

            {admin && props.monthly && (
                <Card title="Évolution sur 12 mois" className="mb-6">
                    <MonthlyChart data={props.monthly} />
                </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title={`À vérifier (${props.taskCounts.review})`} actions={<ButtonLink href="/tasks?view=review" size="sm" variant="ghost">Tout voir</ButtonLink>}>
                    <TaskList tasks={props.toReview} empty="Aucun travail en attente de vérification." />
                </Card>
                <Card title={`En retard (${props.taskCounts.late})`} actions={<ButtonLink href="/tasks?view=late" size="sm" variant="ghost">Tout voir</ButtonLink>}>
                    <TaskList tasks={props.late} empty="Aucune tâche en retard. 👏" />
                </Card>
                <Card title="Charge de l'équipe" actions={<ButtonLink href="/tasks" size="sm" variant="ghost">Répartir</ButtonLink>}>
                    <TeamLoad members={props.workload} />
                </Card>
                <Card title="Prochaines échéances">
                    <TaskList tasks={props.upcoming} empty="Aucune échéance à venir." />
                </Card>
                <Card title="Projets en cours" actions={<ButtonLink href="/projects" size="sm" variant="ghost">Tous les projets</ButtonLink>}>
                    <ProjectsProgress projects={props.projects} admin={admin} />
                </Card>
                {!admin && (
                    <Card title="Répartition des tâches">
                        <StatusBars counts={props.taskCounts} />
                    </Card>
                )}
            </div>

            {admin && props.members && (
                <Card title="Statistiques de l'équipe" className="mt-6" actions={<ButtonLink href="/finances/export/membres" external size="sm" variant="ghost">Export CSV</ButtonLink>}>
                    {props.members.length === 0 ? (
                        <Empty title="Aucun membre pour l'instant." />
                    ) : (
                        <Table>
                            <thead>
                                <tr>
                                    <Th>Membre</Th>
                                    <Th className="text-right">Tâches</Th>
                                    <Th className="text-right">Terminées</Th>
                                    <Th className="text-right">En retard</Th>
                                    <Th className="text-right">Versé (net)</Th>
                                        <Th className="text-right">À payer</Th>
                                    <Th className="text-right">Pénalités dues</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.members.map((m) => (
                                    <tr key={m.id}>
                                        <Td>
                                            <p className="font-medium">{m.name}</p>
                                            <p className="text-xs text-stone-500">{m.role_label}</p>
                                        </Td>
                                        <Td className="tabular text-right">{m.tasks}</Td>
                                        <Td className="tabular text-right">{m.done}</Td>
                                        <Td className={`tabular text-right ${m.late ? 'font-medium text-red-600' : ''}`}>{m.late}</Td>
                                        <Td className="tabular text-right">{fcfa(m.net_paid)}</Td>
                                        <Td className="tabular text-right">{fcfa(m.remaining)}</Td>
                                        <Td className={`tabular text-right ${m.penalty_debt ? 'font-medium text-red-600' : ''}`}>{fcfa(m.penalty_debt)}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card>
            )}

            {admin && props.recentPayments && props.recentPayments.length > 0 && (
                <Card title="Derniers encaissements" className="mt-6">
                    <ul className="-my-2 divide-y divide-stone-100">
                        {props.recentPayments.map((p) => (
                            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Receipt className="size-4 shrink-0 text-stone-400" />
                                    <div className="min-w-0">
                                        <Link href={`/projects/${p.project?.id}`} className="truncate text-sm font-medium hover:underline">{p.project?.name}</Link>
                                        <p className="text-xs text-stone-500">{p.receipt_number} · {p.type_label} · {p.method_label} · {dateTime(p.paid_at)}</p>
                                    </div>
                                </div>
                                <span className="tabular text-sm font-semibold text-emerald-700">+ {fcfa(p.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </AppLayout>
    );
}

function MemberDashboard({ myTasks, taskCounts, earnings }: MemberProps) {
    return (
        <AppLayout title="Tableau de bord">
            <PageHeader title="Mon espace" subtitle="Vos tâches, vos échéances et vos gains." />
            <HowItWorks
                id="member-start"
                title="Bienvenue ! Voici comment ça marche"
                steps={[
                    { title: 'On vous confie une tâche', text: 'Vous recevez une notification. Ouvrez la tâche et lisez les consignes et la date.' },
                    { title: 'Commencez', text: 'Appuyez sur « Commencer » quand vous vous y mettez : l\'admin sait que c\'est en cours.' },
                    { title: 'Livrez avant la date', text: 'Collez le lien de vos fichiers (Drive, WeTransfer…) ou écrivez un message, puis « Livrer ».' },
                    { title: 'Validé = payé', text: 'L\'admin vérifie et valide. Vous retrouvez ce qui vous est dû dans « Mes gains ».' },
                ]}
            />
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="À faire" value={taskCounts.todo} hint={taskCounts.waiting ? `+ ${taskCounts.waiting} en attente de l'étape d'avant` : undefined} icon={<Clock className="size-4" />} />
                <Stat label="En retard" value={taskCounts.late} tone={taskCounts.late ? 'negative' : undefined} icon={<AlertTriangle className="size-4" />} />
                <Stat label="Gains reçus (net)" value={fcfa(earnings.net_paid)} tone="positive" hint={`Reste à recevoir : ${fcfa(earnings.remaining)}`} icon={<Wallet className="size-4" />} />
                <Stat label="Pénalités dues" value={fcfa(earnings.penalty_debt)} tone={earnings.penalty_debt ? 'negative' : undefined} hint="Retenues sur vos prochains versements" icon={<Gavel className="size-4" />} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Mes tâches en cours" className="lg:col-span-2" actions={<ButtonLink href="/tasks" size="sm" variant="ghost">Toutes mes tâches</ButtonLink>}>
                    <TaskList tasks={myTasks} empty="Aucune tâche en cours." showFee />
                </Card>
                <Card title="Rappel">
                    <ul className="space-y-3 text-sm text-stone-600">
                        <li className="flex gap-2"><Hourglass className="mt-0.5 size-4 shrink-0 text-brand-600" />Appuyez sur « Commencer » quand vous attaquez une tâche, puis livrez-la avant la date, avec le lien des fichiers (Drive, WeTransfer…).</li>
                        <li className="flex gap-2"><Link2 className="mt-0.5 size-4 shrink-0 text-brand-600" />Une tâche « En attente » démarre après l'étape d'avant : vous êtes prévenu et recevez ses fichiers, sans pénalité pendant l'attente.</li>
                        <li className="flex gap-2"><Gavel className="mt-0.5 size-4 shrink-0 text-brand-600" />Après la date de livraison, une pénalité est comptée dès le 1er jour de retard, puis régulièrement tant que le travail n'est pas livré.</li>
                        <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" />Une fois validée, la tâche est verrouillée et peut vous être payée.</li>
                    </ul>
                    <ButtonLink href="/me/earnings" className="mt-5 w-full">Voir mes gains</ButtonLink>
                </Card>
            </div>
        </AppLayout>
    );
}

export default function Dashboard(props: StaffProps | MemberProps) {
    if (props.role === 'admin' || props.role === 'super_admin' || props.role === 'assistant') {
        return <StaffDashboard {...(props as StaffProps)} />;
    }
    return <MemberDashboard {...(props as MemberProps)} />;
}
