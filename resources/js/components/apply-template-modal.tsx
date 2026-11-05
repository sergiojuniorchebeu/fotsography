import { useForm } from '@inertiajs/react';
import { Link2, LayoutTemplate } from 'lucide-react';
import { useMemo } from 'react';
import { workloadLabel } from '@/components/task-form';
import { Button, Checkbox, Empty, Input, Modal, Select, formErrorBanner } from '@/components/ui';
import { fcfa } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Member, TemplatePreview } from '@/types';

type Row = { key: string; include: boolean; assigned_to: string; due_date: string };

const rowsFor = (tpl?: TemplatePreview): Row[] =>
    (tpl?.tasks ?? []).map((t) => ({ key: t.key, include: true, assigned_to: t.assigned_to ? String(t.assigned_to) : '', due_date: t.due_date }));

/**
 * Pick a template, then check who does what and when before creating the tasks.
 * People are pre-selected by role, least busy first; dates come from the event / delivery dates.
 */
export function ApplyTemplateModal({ open, onClose, projectId, templates, members, initialId, isAdmin, hasTasks, shareLeft }: {
    open: boolean;
    onClose: () => void;
    projectId: number;
    templates: TemplatePreview[];
    members: Member[];
    initialId?: number;
    isAdmin: boolean;
    hasTasks: boolean;
    shareLeft?: number | null;
}) {
    const first = templates.find((t) => t.id === initialId) ?? templates[0];
    const form = useForm<{ template_id: number | ''; rows: Row[]; skip_shares: boolean }>({ template_id: first?.id ?? '', rows: rowsFor(first), skip_shares: false });
    const tpl = templates.find((t) => t.id === form.data.template_id);
    const byKey = useMemo(() => Object.fromEntries((tpl?.tasks ?? []).map((t) => [t.key, t])), [tpl]);

    const pick = (id: string) => {
        const next = templates.find((t) => String(t.id) === id);
        form.setData({ template_id: next?.id ?? '', rows: rowsFor(next), skip_shares: false });
    };
    const setRow = (i: number, patch: Partial<Row>) => form.setData('rows', form.data.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    const kept = form.data.rows.filter((r) => r.include);
    const shares = kept.reduce((s, r) => s + (byKey[r.key]?.client_share ?? 0), 0);
    const fees = kept.reduce((s, r) => s + (byKey[r.key]?.member_fee ?? 0), 0);
    const err = form.errors as Record<string, string | undefined>;
    const tooMuch = isAdmin && shareLeft != null && shares > shareLeft;

    // Group rows by activity, keeping the template order.
    const groups: { activity: string; items: number[] }[] = [];
    (tpl?.tasks ?? []).forEach((t, i) => {
        const g = groups.find((x) => x.activity === t.activity);
        if (g) g.items.push(i);
        else groups.push({ activity: t.activity, items: [i] });
    });

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xl"
            title="Appliquer un modèle"
            description="Vérifiez qui fait quoi et pour quand. Les personnes sont proposées selon leur rôle, la moins chargée en premier."
            onSubmit={() => form.post(`/projects/${projectId}/apply-template`, { preserveScroll: true, onSuccess: onClose })}
            dirty={form.isDirty}
            errorBanner={formErrorBanner(form.errors)}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing} disabled={!tpl || kept.length === 0 || (tooMuch && !form.data.skip_shares)}>Créer {kept.length} tâche(s)</Button>
                </>
            }
        >
            {templates.length === 0 ? (
                <Empty icon={<LayoutTemplate className="size-10" />} title="Aucun modèle.">{isAdmin ? 'Créez-en un dans « Modèles de projet ».' : 'Demandez à l\'admin d\'en créer un.'}</Empty>
            ) : (
                <div className="space-y-4">
                    <Select value={String(form.data.template_id)} onChange={(e) => pick(e.target.value)}>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.tasks.length} tâche(s)</option>)}
                    </Select>
                    {tpl?.description && <p className="-mt-2 text-sm text-stone-500">{tpl.description}</p>}
                    {hasTasks && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">Ce projet a déjà des tâches : celles du modèle s'ajoutent, rien n'est remplacé.</p>}
                    {tooMuch && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200">
                            <p>Les parts client du modèle ({fcfa(shares)}) dépassent ce qui reste du prix du projet ({fcfa(shareLeft!)}).</p>
                            <div className="mt-2"><Checkbox label="Créer les tâches sans part client (à répartir ensuite)" checked={form.data.skip_shares} onChange={(v) => form.setData('skip_shares', v)} /></div>
                        </div>
                    )}
                    {err.rows && <p className="text-sm font-medium text-red-600">{err.rows}</p>}

                    {groups.map((g) => (
                        <div key={g.activity}>
                            <p className="mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">{g.activity}</p>
                            <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200/70">
                                {g.items.map((i) => {
                                    const t = tpl!.tasks[i];
                                    const r = form.data.rows[i];
                                    const after = t.after ? byKey[t.after] : null;
                                    const options = members.filter((m) => m.role !== 'assistant');
                                    const sameRole = options.filter((m) => m.role === t.role);
                                    const others = options.filter((m) => m.role !== t.role);
                                    return (
                                        <li key={t.key} className={cn('grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_18rem_9.5rem] sm:items-start', !r.include && 'opacity-50')}>
                                            <div className="min-w-0">
                                                <Checkbox label={<span className="font-medium">{t.name}</span>} checked={r.include} onChange={(v) => setRow(i, { include: v })} />
                                                <p className="mt-0.5 pl-6 text-xs text-stone-500">
                                                    {t.role_label ?? 'Tout rôle'}
                                                    {isAdmin && t.member_fee ? ` · ${fcfa(t.member_fee)}` : ''}
                                                    {isAdmin && t.client_share && !form.data.skip_shares ? ` · part client ${fcfa(t.client_share)}` : ''}
                                                </p>
                                                {after && (
                                                    <p className="mt-0.5 flex items-center gap-1 pl-6 text-xs text-stone-500">
                                                        <Link2 className="size-3" />après « {after.name} »{form.data.rows.find((x) => x.key === after.key)?.include === false ? ' (retirée : attendra l\'étape d\'avant)' : ''}
                                                    </p>
                                                )}
                                            </div>
                                            {r.include && (
                                                <>
                                                    <div>
                                                        <Select aria-label={`Qui fait « ${t.name} »`} value={r.assigned_to} onChange={(e) => setRow(i, { assigned_to: e.target.value })} className={cn(err[`rows.${t.key}.assigned_to`] && 'ring-red-400')}>
                                                            <option value="">Choisir…</option>
                                                            {sameRole.length > 0 && <optgroup label={t.role_label ?? 'Rôle'}>{sameRole.map((m) => <option key={m.id} value={m.id}>{m.name} · {workloadLabel(m)}</option>)}</optgroup>}
                                                            <optgroup label={sameRole.length ? 'Autres' : 'Équipe'}>{others.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role_label} · {workloadLabel(m)}</option>)}</optgroup>
                                                        </Select>
                                                        {err[`rows.${t.key}.assigned_to`] && <p className="mt-1 text-xs text-red-600">{err[`rows.${t.key}.assigned_to`]}</p>}
                                                    </div>
                                                    <Input type="date" aria-label="Date de livraison" value={r.due_date} onChange={(e) => setRow(i, { due_date: e.target.value })} />
                                                </>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {isAdmin && (
                        <p className="text-xs text-stone-500">Total : {fcfa(fees)} de rémunérations · {form.data.skip_shares ? 'aucune part client' : `${fcfa(shares)} de parts client`}. Tout reste modifiable tâche par tâche ensuite.</p>
                    )}
                </div>
            )}
        </Modal>
    );
}
