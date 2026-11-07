import { useForm, usePage } from '@inertiajs/react';
import { Button, Field, Input, Modal, MoneyInput, Select, Textarea, formErrorBanner } from '@/components/ui';
import { date } from '@/lib/format';
import type { Member, SiblingTask, Task } from '@/types';

/** "Paul — Monteur · 3 en cours, 1 en retard": helps spread the work. */
export function workloadLabel(m: Member): string {
    const parts = [];
    if (m.open_count) parts.push(`${m.open_count} en cours`);
    if (m.waiting_count) parts.push(`${m.waiting_count} en attente`);
    if (m.review_count) parts.push(`${m.review_count} à vérifier`);
    if (m.late_count) parts.push(`${m.late_count} en retard`);
    return parts.length ? parts.join(', ') : 'disponible';
}

const ACTIVITY_IDEAS = ['Photo', 'Vidéo', 'Retouche', 'Montage', 'Album', 'Impression'];

export function TaskFormModal({
    open,
    onClose,
    projectId,
    activities = [],
    activityId,
    task,
    members,
    siblings = [],
    defaultDueDate,
    minDate,
    maxDate,
}: {
    open: boolean;
    onClose: () => void;
    projectId?: number;
    activities?: { id: number; name: string }[];
    activityId?: number;
    task?: Task;
    members: Member[];
    siblings?: SiblingTask[];
    defaultDueDate?: string;
    minDate?: string;
    maxDate?: string;
}) {
    const admin = usePage().props.auth.user!.is_admin;
    const startNew = !task && !activityId && activities.length === 0;
    const form = useForm({
        name: task?.name ?? '',
        activity_id: activityId ? String(activityId) : !task && activities.length === 1 ? String(activities[0].id) : '',
        activity_name: '',
        new_activity: startNew,
        instructions: task?.instructions ?? '',
        assigned_to: task?.assignee ? String(task.assignee.id) : '',
        due_date: task?.due_date ?? defaultDueDate ?? '',
        depends_on_id: task?.depends_on_id ? String(task.depends_on_id) : '',
        member_fee: (task?.member_fee ?? '') as number | '',
    });

    const assignee = members.find((m) => String(m.id) === form.data.assigned_to);
    const assigneeIsAdmin = assignee?.role === 'admin' || assignee?.role === 'super_admin';
    const options = siblings.filter((s) => s.id !== task?.id);
    const dep = options.find((s) => String(s.id) === form.data.depends_on_id);
    const depAfterDue = dep && form.data.due_date && dep.due_date > form.data.due_date;
    const ideas = ACTIVITY_IDEAS.filter((i) => !activities.some((a) => a.name.toLowerCase() === i.toLowerCase()));

    const submit = () => {
        form.transform((d) => {
            const out: Record<string, unknown> = { name: d.name, instructions: d.instructions, assigned_to: d.assigned_to, due_date: d.due_date, depends_on_id: d.depends_on_id || null };
            if (!task) {
                if (d.new_activity) out.activity_name = d.activity_name;
                else out.activity_id = d.activity_id || null;
            }
            if (admin) {
                out.member_fee = assigneeIsAdmin ? 0 : Number(d.member_fee || 0);
            }
            return out;
        });
        const opts = { preserveScroll: true, onSuccess: () => { onClose(); if (!task) { form.reset(); } } };
        if (task) {
            form.put(`/tasks/${task.id}`, opts);
        } else if (projectId) {
            form.post(`/projects/${projectId}/tasks`, opts);
        } else {
            form.post(`/activities/${activityId}/tasks`, opts);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)}
            size="lg"
            title={task ? 'Modifier la tâche' : 'Nouvelle tâche'}
            description={task ? undefined : 'Qui fait quoi, et pour quand. La personne est prévenue tout de suite.'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>{task ? 'Enregistrer' : 'Créer la tâche'}</Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Que faut-il faire ?" error={form.errors.name} className="sm:col-span-2">
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="ex. Retouche des photos de la cérémonie" />
                </Field>

                {!task && projectId && (
                    <Field
                        label="Dans quelle activité ?"
                        error={form.errors.activity_id ?? form.errors.activity_name}
                        className="sm:col-span-2"
                        hint="Une activité regroupe les tâches d'une même partie du projet (Photo, Vidéo, Album…). Elle sert aussi à ranger les dépenses."
                    >
                        {form.data.new_activity ? (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input value={form.data.activity_name} onChange={(e) => form.setData('activity_name', e.target.value)} placeholder="Nom de la nouvelle activité" />
                                    {activities.length > 0 && <Button variant="secondary" onClick={() => form.setData((d) => ({ ...d, new_activity: false, activity_name: '' }))}>Annuler</Button>}
                                </div>
                                {ideas.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {ideas.map((i) => (
                                            <button key={i} type="button" onClick={() => form.setData('activity_name', i)} className={`rounded-full px-2.5 py-1 text-xs ring-1 transition ${form.data.activity_name === i ? 'bg-ink text-white ring-ink' : 'bg-white text-stone-600 ring-stone-200 hover:ring-stone-300'}`}>{i}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Select value={form.data.activity_id} onChange={(e) => (e.target.value === '__new' ? form.setData((d) => ({ ...d, new_activity: true, activity_id: '' })) : form.setData('activity_id', e.target.value))}>
                                <option value="">Choisir…</option>
                                {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                <option value="__new">＋ Nouvelle activité…</option>
                            </Select>
                        )}
                    </Field>
                )}

                <Field label="Qui s'en occupe ?" error={form.errors.assigned_to} hint="Les moins chargés apparaissent avec « disponible ».">
                    <Select value={form.data.assigned_to} onChange={(e) => form.setData('assigned_to', e.target.value)}>
                        <option value="">Choisir une personne…</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role_label}{m.open_count !== undefined ? ` · ${workloadLabel(m)}` : ''}</option>)}
                    </Select>
                </Field>
                <Field label="À livrer le" error={form.errors.due_date} hint={!task && defaultDueDate ? `Proposé dans la durée du projet (${minDate ?? 'début'} – ${maxDate ?? 'livraison'}).` : 'Après cette date, les pénalités de retard commencent.'}>
                    <Input type="date" min={minDate} max={maxDate} value={form.data.due_date} onChange={(e) => form.setData('due_date', e.target.value)} />
                </Field>
                {options.length > 0 && (
                    <Field
                        label="Doit attendre une autre tâche ? (facultatif)"
                        error={form.errors.depends_on_id ?? (depAfterDue ? `« ${dep!.name} » est due le ${date(dep!.due_date)} : laissez du temps après.` : undefined)}
                        className="sm:col-span-2"
                        hint="Ex. la retouche attend le shooting. La personne est prévenue quand l'étape d'avant est validée, reçoit ses fichiers, et n'a pas de pénalité tant qu'elle attend."
                    >
                        <Select value={form.data.depends_on_id} onChange={(e) => form.setData('depends_on_id', e.target.value)}>
                            <option value="">Non, elle peut commencer tout de suite</option>
                            {options.map((s) => <option key={s.id} value={s.id}>Après « {s.name} »{s.assignee ? ` (${s.assignee})` : ''} — {s.status_label}</option>)}
                        </Select>
                    </Field>
                )}
                <Field label="Consignes (facultatif)" error={form.errors.instructions} className="sm:col-span-2">
                    <Textarea rows={3} value={form.data.instructions} onChange={(e) => form.setData('instructions', e.target.value)} placeholder="Ce qui est attendu : nombre de photos, style, format…" />
                </Field>
                {admin && (
                    <Field label="Payé combien à la personne ?" error={form.errors.member_fee} className="sm:col-span-2" hint={assigneeIsAdmin ? 'Une tâche faite par l\'admin n\'est pas rémunérée.' : 'Ce qu\'elle touchera une fois la tâche validée. Laissez vide si rien n\'est prévu.'}>
                        <MoneyInput value={assigneeIsAdmin ? 0 : form.data.member_fee} disabled={assigneeIsAdmin} onChange={(v) => form.setData('member_fee', v)} />
                    </Field>
                )}
            </div>
        </Modal>
    );
}
