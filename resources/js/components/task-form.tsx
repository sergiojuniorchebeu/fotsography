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

export function TaskFormModal({
    open,
    onClose,
    activityId,
    task,
    members,
    siblings = [],
    defaultDueDate,
}: {
    open: boolean;
    onClose: () => void;
    activityId?: number;
    task?: Task;
    members: Member[];
    siblings?: SiblingTask[];
    defaultDueDate?: string;
}) {
    const admin = usePage().props.auth.user!.is_admin;
    const form = useForm({
        name: task?.name ?? '',
        instructions: task?.instructions ?? '',
        assigned_to: task?.assignee ? String(task.assignee.id) : '',
        due_date: task?.due_date ?? defaultDueDate ?? '',
        depends_on_id: task?.depends_on_id ? String(task.depends_on_id) : '',
        client_share: (task?.client_share ?? '') as number | '',
        member_fee: (task?.member_fee ?? '') as number | '',
    });

    const assignee = members.find((m) => String(m.id) === form.data.assigned_to);
    const assigneeIsAdmin = assignee?.role === 'admin';
    const options = siblings.filter((s) => s.id !== task?.id);
    const dep = options.find((s) => String(s.id) === form.data.depends_on_id);
    const depAfterDue = dep && form.data.due_date && dep.due_date >= form.data.due_date;

    const submit = () => {
        form.transform((d) => {
            const out: Record<string, unknown> = { name: d.name, instructions: d.instructions, assigned_to: d.assigned_to, due_date: d.due_date, depends_on_id: d.depends_on_id || null };
            if (admin) {
                out.client_share = Number(d.client_share || 0);
                out.member_fee = assigneeIsAdmin ? 0 : Number(d.member_fee || 0);
            }
            return out;
        });
        const opts = { preserveScroll: true, onSuccess: () => { onClose(); if (!task) { form.reset(); } } };
        if (task) {
            form.put(`/tasks/${task.id}`, opts);
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
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>Enregistrer</Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de la tâche" error={form.errors.name} className="sm:col-span-2">
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Retouche des photos de la cérémonie" />
                </Field>
                <Field label="Instructions détaillées" error={form.errors.instructions} className="sm:col-span-2">
                    <Textarea rows={5} value={form.data.instructions} onChange={(e) => form.setData('instructions', e.target.value)} placeholder="Ce qui est attendu, format, nombre de photos, style…" />
                </Field>
                <Field label="Assignée à" error={form.errors.assigned_to}>
                    <Select value={form.data.assigned_to} onChange={(e) => form.setData('assigned_to', e.target.value)}>
                        <option value="">Choisir un membre…</option>
                        {members.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role_label}{m.open_count !== undefined ? ` · ${workloadLabel(m)}` : ''}</option>)}
                    </Select>
                </Field>
                <Field label="Date de livraison" error={form.errors.due_date} hint={!task && defaultDueDate ? 'Par défaut : avant la livraison globale du projet.' : undefined}>
                    <Input type="date" value={form.data.due_date} onChange={(e) => form.setData('due_date', e.target.value)} />
                </Field>
                {options.length > 0 && (
                    <Field
                        label="Commence après (facultatif)"
                        error={form.errors.depends_on_id ?? (depAfterDue ? `« ${dep!.name} » est due le ${date(dep!.due_date)} : laissez du temps après.` : undefined)}
                        className="sm:col-span-2"
                        hint="Ex. la retouche commence après le shooting. La personne est prévenue quand l'étape d'avant est validée, reçoit ses fichiers, et n'a pas de pénalité tant qu'elle attend."
                    >
                        <Select value={form.data.depends_on_id} onChange={(e) => form.setData('depends_on_id', e.target.value)}>
                            <option value="">Peut commencer tout de suite</option>
                            {options.map((s) => <option key={s.id} value={s.id}>{s.name}{s.assignee ? ` (${s.assignee})` : ''} — {s.status_label}</option>)}
                        </Select>
                    </Field>
                )}
                {admin && (
                    <>
                        <Field label="Part client" error={form.errors.client_share} hint="Part du prix du projet correspondant à cette tâche.">
                            <MoneyInput value={form.data.client_share} onChange={(v) => form.setData('client_share', v)} />
                        </Field>
                        <Field label="Rémunération du membre" error={form.errors.member_fee} hint={assigneeIsAdmin ? 'Une tâche assignée à l\'admin n\'a pas de rémunération.' : 'Ce que le membre touchera pour cette tâche.'}>
                            <MoneyInput value={assigneeIsAdmin ? 0 : form.data.member_fee} disabled={assigneeIsAdmin} onChange={(v) => form.setData('member_fee', v)} />
                        </Field>
                    </>
                )}
            </div>
        </Modal>
    );
}
