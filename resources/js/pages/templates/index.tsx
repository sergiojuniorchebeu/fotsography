import { useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Copy, LayoutTemplate, Link2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { confirmDialog } from '@/components/confirm-dialog';
import { Badge, Button, Card, Empty, Field, Input, Modal, MoneyInput, PageHeader, Select, Textarea, formErrorBanner } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { fcfa } from '@/lib/format';
import type { Option, ProjectTemplate, TemplateTask } from '@/types';

type Activity = { name: string; tasks: TemplateTask[] };

const newKey = () => 't' + Math.random().toString(36).slice(2, 9);
const blankTask = (): TemplateTask => ({ key: newKey(), name: '', instructions: null, role: null, from: 'delivery', days: 3, member_fee: 0, client_pct: 0, after: null });

export function whenLabel(t: Pick<TemplateTask, 'from' | 'days'>): string {
    if (t.from === 'event') return t.days === 0 ? "Jour de l'événement" : `Événement + ${t.days} j`;
    return t.days === 0 ? 'Jour de la livraison' : `Livraison − ${t.days} j`;
}

function TaskEditor({ task, index, total, roles, others, onChange, onRemove, onMove }: {
    task: TemplateTask;
    index: number;
    total: number;
    roles: Option[];
    others: TemplateTask[];
    onChange: (patch: Partial<TemplateTask>) => void;
    onRemove: () => void;
    onMove: (dir: -1 | 1) => void;
}) {
    const [notes, setNotes] = useState(!!task.instructions);
    return (
        <li className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <div className="flex items-start gap-2">
                <Input aria-label="Nom de la tâche" value={task.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Retouche des photos" className="flex-1" />
                <div className="flex shrink-0">
                    <Button size="sm" variant="ghost" aria-label="Monter" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Descendre" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Retirer la tâche" onClick={onRemove}><X className="size-3.5" /></Button>
                </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Rôle">
                    <Select value={task.role ?? ''} onChange={(e) => onChange({ role: e.target.value || null })}>
                        <option value="">Tout rôle</option>
                        {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                </Field>
                <Field label="À livrer">
                    <div className="flex gap-2">
                        <Select value={task.from} onChange={(e) => onChange({ from: e.target.value as TemplateTask['from'] })} className="min-w-0 flex-1">
                            <option value="event">Événement +</option>
                            <option value="delivery">Livraison −</option>
                        </Select>
                        <Input type="number" min={0} max={365} aria-label="Nombre de jours" title="Nombre de jours" value={task.days} onChange={(e) => onChange({ days: Math.max(0, Number(e.target.value)) })} className="w-16" />
                    </div>
                    <span className="mt-1 block text-xs text-stone-500">{whenLabel(task)}</span>
                </Field>
                <Field label="Rémunération">
                    <MoneyInput value={task.member_fee} onChange={(v) => onChange({ member_fee: Number(v || 0) })} />
                </Field>
                <Field label="Part du prix client (%)">
                    <Input type="number" min={0} max={100} value={task.client_pct} onChange={(e) => onChange({ client_pct: Math.min(100, Math.max(0, Number(e.target.value))) })} />
                </Field>
                <Field label="Commence après" className="sm:col-span-2">
                    <Select value={task.after ?? ''} onChange={(e) => onChange({ after: e.target.value || null })}>
                        <option value="">Peut commencer tout de suite</option>
                        {others.filter((o) => o.name).map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
                    </Select>
                </Field>
                <div className="sm:col-span-2 lg:pt-6">
                    {!notes && <Button size="sm" variant="ghost" onClick={() => setNotes(true)}><Plus className="size-3.5" />Instructions</Button>}
                </div>
                {notes && (
                    <Field label="Instructions" className="sm:col-span-2 lg:col-span-4">
                        <Textarea rows={2} value={task.instructions ?? ''} onChange={(e) => onChange({ instructions: e.target.value || null })} placeholder="Format, nombre de photos, style…" />
                    </Field>
                )}
            </div>
        </li>
    );
}

function TemplateEditor({ template, copy, roles, onClose }: { template?: ProjectTemplate; copy?: boolean; roles: Option[]; onClose: () => void }) {
    const form = useForm<{ name: string; description: string; structure: { activities: Activity[] } }>({
        name: template ? (copy ? `${template.name} (copie)` : template.name) : '',
        description: template?.description ?? '',
        structure: template ? structuredClone(template.structure) : { activities: [{ name: 'Shooting', tasks: [blankTask()] }] },
    });
    const acts = form.data.structure.activities;
    const all = acts.flatMap((a) => a.tasks);
    const pct = all.reduce((s, t) => s + (t.client_pct || 0), 0);
    const fees = all.reduce((s, t) => s + (t.member_fee || 0), 0);

    const setActs = (next: Activity[]) => form.setData('structure', { activities: next });
    const setAct = (i: number, patch: Partial<Activity>) => setActs(acts.map((a, j) => (j === i ? { ...a, ...patch } : a)));
    const setTask = (i: number, k: number, patch: Partial<TemplateTask>) => setAct(i, { tasks: acts[i].tasks.map((t, j) => (j === k ? { ...t, ...patch } : t)) });
    const removeTask = (i: number, k: number) => {
        const gone = acts[i].tasks[k];
        // Whatever waited for the removed task now waits for what it waited for.
        setActs(acts.map((a, j) => ({ ...a, tasks: a.tasks.filter((_, x) => !(j === i && x === k)).map((t) => (t.after === gone.key ? { ...t, after: gone.after } : t)) })));
    };
    const moveTask = (i: number, k: number, dir: -1 | 1) => {
        const tasks = [...acts[i].tasks];
        [tasks[k], tasks[k + dir]] = [tasks[k + dir], tasks[k]];
        setAct(i, { tasks });
    };
    const removeAct = (i: number) => {
        const gone = new Map(acts[i].tasks.map((t) => [t.key, t.after]));
        const resolve = (k: string | null): string | null => (k && gone.has(k) ? resolve(gone.get(k) ?? null) : k);
        setActs(acts.filter((_, j) => j !== i).map((a) => ({ ...a, tasks: a.tasks.map((t) => ({ ...t, after: resolve(t.after) })) })));
    };

    const submit = () => {
        const opts = { preserveScroll: true, onSuccess: onClose };
        if (template && !copy) form.put(`/templates/${template.id}`, opts);
        else form.post('/templates', opts);
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="xl"
            title={template && !copy ? 'Modifier le modèle' : 'Nouveau modèle'}
            description="Décrivez les étapes habituelles. Les dates se calculent à partir de l'événement ou de la livraison du projet ; les personnes sont choisies au moment d'appliquer le modèle."
            onSubmit={submit}
            dirty={form.isDirty}
            errorBanner={formErrorBanner(form.errors)}
            footer={
                <>
                    <span className={`mr-auto hidden text-xs sm:inline ${pct > 100 ? 'font-medium text-red-600' : 'text-stone-500'}`}>{all.length} tâche(s) · {fcfa(fees)} de rémunérations · {pct} % du prix client</span>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>Enregistrer</Button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom du modèle" error={form.errors.name}>
                        <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Mariage formule complète" />
                    </Field>
                    <Field label="Description (facultatif)">
                        <Input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Ce que comprend la formule" />
                    </Field>
                </div>
                {pct > 100 && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">Le total des parts client fait {pct} % : il ne peut pas dépasser 100 %.</p>}

                {acts.map((a, i) => (
                    <section key={i} className="rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200/70 sm:p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <Input aria-label="Nom de l'activité" value={a.name} onChange={(e) => setAct(i, { name: e.target.value })} placeholder="Nom de l'activité (Shooting, Montage…)" className="flex-1 font-medium" />
                            {acts.length > 1 && <Button size="sm" variant="ghost" aria-label="Retirer l'activité" onClick={() => removeAct(i)}><Trash2 className="size-4" /></Button>}
                        </div>
                        <ul className="space-y-3">
                            {a.tasks.map((t, k) => (
                                <TaskEditor key={t.key} task={t} index={k} total={a.tasks.length} roles={roles} others={all.filter((o) => o.key !== t.key)} onChange={(p) => setTask(i, k, p)} onRemove={() => removeTask(i, k)} onMove={(d) => moveTask(i, k, d)} />
                            ))}
                        </ul>
                        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setAct(i, { tasks: [...a.tasks, blankTask()] })}><Plus className="size-3.5" />Ajouter une tâche</Button>
                    </section>
                ))}
                <Button variant="secondary" onClick={() => setActs([...acts, { name: '', tasks: [blankTask()] }])}><Plus className="size-4" />Ajouter une activité</Button>
            </div>
        </Modal>
    );
}

function TemplateCard({ t, roleLabel, onEdit, onCopy }: { t: ProjectTemplate; roleLabel: (r: string | null) => string; onEdit: () => void; onCopy: () => void }) {
    const names = Object.fromEntries(t.structure.activities.flatMap((a) => a.tasks).map((x) => [x.key, x.name]));
    return (
        <Card
            title={<span className="flex flex-wrap items-center gap-2">{t.name}<Badge>{t.tasks_count} tâche(s)</Badge>{t.client_pct_total > 0 && <Badge tone="stone">{t.client_pct_total} % du prix</Badge>}</span>}
            actions={
                <>
                    <Button size="sm" variant="secondary" onClick={onEdit}><Pencil className="size-3.5" />Modifier</Button>
                    <Button size="sm" variant="ghost" aria-label="Dupliquer" title="Dupliquer" onClick={onCopy}><Copy className="size-3.5" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Supprimer" title="Supprimer" onClick={() => void confirmDialog({ title: 'Supprimer ce modèle', confirmLabel: 'Supprimer', message: <>Le modèle « {t.name} » ne sera plus proposé. Les projets déjà créés avec ne changent pas.</>, request: { method: 'delete', url: `/templates/${t.id}` } })}><Trash2 className="size-3.5" /></Button>
                </>
            }
        >
            {t.description && <p className="mb-4 text-sm text-stone-500">{t.description}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
                {t.structure.activities.map((a, i) => (
                    <div key={i}>
                        <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">{a.name}</p>
                        <ul className="space-y-1.5">
                            {a.tasks.map((x) => (
                                <li key={x.key} className="text-sm">
                                    <p className="font-medium text-stone-800">{x.name}</p>
                                    <p className="text-xs text-stone-500">
                                        {roleLabel(x.role)} · {whenLabel(x)}
                                        {x.member_fee > 0 && ` · ${fcfa(x.member_fee)}`}
                                        {x.client_pct > 0 && ` · ${x.client_pct} %`}
                                    </p>
                                    {x.after && <p className="flex items-center gap-1 text-xs text-stone-500"><Link2 className="size-3" />après « {names[x.after]} »</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default function TemplatesIndex({ templates, roles }: { templates: ProjectTemplate[]; roles: Option[] }) {
    const [editing, setEditing] = useState<{ template?: ProjectTemplate; copy?: boolean; key: number } | null>(null);
    const roleLabel = (r: string | null) => roles.find((x) => x.value === r)?.label ?? 'Tout rôle';

    return (
        <AppLayout title="Modèles de projet">
            <PageHeader
                title="Modèles de projet"
                subtitle="Vos formules habituelles. En créant un projet, choisissez un modèle : toutes les tâches sont créées, datées, enchaînées et réparties dans l'équipe."
                actions={<Button onClick={() => setEditing({ key: Date.now() })}><Plus className="size-4" />Nouveau modèle</Button>}
            />
            {templates.length === 0 ? (
                <Card>
                    <Empty icon={<LayoutTemplate className="size-10" />} title="Aucun modèle">
                        Créez-en un ici, ou ouvrez un projet réussi et cliquez sur « Enregistrer comme modèle ».
                    </Empty>
                </Card>
            ) : (
                <div className="space-y-6">
                    {templates.map((t) => (
                        <TemplateCard key={t.id} t={t} roleLabel={roleLabel} onEdit={() => setEditing({ template: t, key: Date.now() })} onCopy={() => setEditing({ template: t, copy: true, key: Date.now() })} />
                    ))}
                    <p className="text-center text-xs text-stone-500">Astuce : depuis un projet terminé, l'icône « Enregistrer comme modèle » reprend toutes ses tâches.</p>
                </div>
            )}
            {editing && <TemplateEditor key={editing.key} template={editing.template} copy={editing.copy} roles={roles} onClose={() => setEditing(null)} />}
        </AppLayout>
    );
}
