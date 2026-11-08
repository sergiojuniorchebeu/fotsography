import { useForm } from '@inertiajs/react';
import { Button, Field, Input, Modal, MoneyInput, Select, Textarea, formErrorBanner } from '@/components/ui';
import { fcfa } from '@/lib/format';
import type { Option, Project } from '@/types';

export function ProjectFormModal({
    open,
    onClose,
    project,
    clients,
    statuses,
    defaults,
    templates = [],
}: {
    open: boolean;
    onClose: () => void;
    project?: Project;
    clients: { id: number; name: string }[];
    statuses: Option[];
    defaults?: { advance_pct: number; intermediate_pct: number; balance_pct: number };
    templates?: { id: number; name: string }[];
}) {
    const form = useForm({
        client_id: project?.client?.id ? String(project.client.id) : '',
        name: project?.name ?? '',
        location: project?.location ?? '',
        event_date: project?.event_date ?? '',
        start_date: project?.start_date ?? new Date().toLocaleDateString('sv-SE'),
        delivery_date: project?.delivery_date ?? '',
        total_amount: (project?.total_amount ?? '') as number | '',
        advance_pct: project?.advance_pct ?? defaults?.advance_pct ?? 30,
        intermediate_pct: project?.intermediate_pct ?? defaults?.intermediate_pct ?? 50,
        balance_pct: project?.balance_pct ?? defaults?.balance_pct ?? 20,
        notes: project?.notes ?? '',
        status: project?.status ?? 'in_progress',
        template_id: '',
    });

    const total = Number(form.data.total_amount || 0);
    const adv = Math.floor((total * Number(form.data.advance_pct)) / 100);
    const mid = Math.floor((total * Number(form.data.intermediate_pct)) / 100);
    const pctSum = Number(form.data.advance_pct) + Number(form.data.intermediate_pct) + Number(form.data.balance_pct);

    const submit = () => {
        form.transform((d) => ({ ...d, total_amount: Number(d.total_amount || 0) }));
        if (project) {
            form.put(`/projects/${project.id}`, { preserveScroll: true, onSuccess: onClose });
        } else {
            form.post('/projects', { onSuccess: onClose });
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)}
            size="lg"
            title={project ? 'Modifier le projet' : 'Nouveau projet'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>Enregistrer</Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client" error={form.errors.client_id}>
                    <Select value={form.data.client_id} onChange={(e) => form.setData('client_id', e.target.value)}>
                        <option value="">Choisir…</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                </Field>
                <Field label="Statut" error={form.errors.status}>
                    <Select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                </Field>
                <Field label="Nom de l'événement" error={form.errors.name}>
                    <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="Mariage de Paul & Aïcha" />
                </Field>
                <Field label="Lieu" error={form.errors.location}>
                    <Input value={form.data.location} onChange={(e) => form.setData('location', e.target.value)} placeholder="Douala, Bonapriso" />
                </Field>
                <Field label="Date de l'événement" error={form.errors.event_date}>
                    <Input type="date" min={form.data.start_date || undefined} max={form.data.delivery_date || undefined} value={form.data.event_date} onChange={(e) => form.setData('event_date', e.target.value)} />
                </Field>
                <Field label="Début du projet" error={form.errors.start_date} hint="Première date possible pour une échéance de tâche.">
                    <Input type="date" value={form.data.start_date} max={form.data.delivery_date || undefined} onChange={(e) => form.setData('start_date', e.target.value)} />
                </Field>
                <Field label="Livraison au client" error={form.errors.delivery_date} hint="Date à laquelle le client reçoit tout. Les tâches sont proposées quelques jours avant.">
                    <Input type="date" value={form.data.delivery_date} min={form.data.start_date || undefined} onChange={(e) => form.setData('delivery_date', e.target.value)} />
                </Field>
                <Field label="Prix payé par le client" error={form.errors.total_amount} className="sm:col-span-2">
                    <MoneyInput value={form.data.total_amount} onChange={(v) => form.setData('total_amount', v)} />
                </Field>
                <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200/70 sm:col-span-2">
                    <p className="text-sm font-medium">En combien de fois le client paie ?</p>
                    <p className="mb-3 text-xs text-stone-500">Mettez 0 % à une tranche si elle n'existe pas (ex. 50 % d'avance, 0 %, 50 % de solde).</p>
                    <div className="grid grid-cols-3 gap-3">
                        {([['advance_pct', 'Avance', adv], ['intermediate_pct', 'Intermédiaire', mid], ['balance_pct', 'Solde', total - adv - mid]] as const).map(([key, label, amount]) => (
                            <Field key={key} label={`${label} (%)`}>
                                <Input type="number" min={0} max={100} value={form.data[key]} onChange={(e) => form.setData(key, Number(e.target.value))} />
                                <span className="tabular mt-1 block text-xs text-stone-500">{fcfa(amount)}</span>
                            </Field>
                        ))}
                    </div>
                    {(form.errors.advance_pct || pctSum !== 100) && (
                        <p className="mt-2 text-xs font-medium text-red-600">{form.errors.advance_pct ?? `Total : ${pctSum} % (doit faire 100 %)`}</p>
                    )}
                    <p className="mt-2 text-xs text-stone-500">Les arrondis vont sur le solde.</p>
                </div>
                {!project && templates.length > 0 && (
                    <Field label="Partir d'un modèle (facultatif)" className="sm:col-span-2" hint="Après l'enregistrement, vous vérifiez qui fait quoi et les dates, puis toutes les tâches sont créées d'un coup.">
                        <Select value={form.data.template_id} onChange={(e) => form.setData('template_id', e.target.value)}>
                            <option value="">Aucun : je crée les tâches moi-même</option>
                            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </Select>
                    </Field>
                )}
                <Field label="Notes" error={form.errors.notes} className="sm:col-span-2">
                    <Textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}
