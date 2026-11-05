import { useForm } from '@inertiajs/react';
import { Button, Field, Input, Modal, Select, Textarea, formErrorBanner } from '@/components/ui';
import { fcfa } from '@/lib/format';
import type { Option } from '@/types';

/**
 * Cancel penalties with a mandatory reason. When part of the amount was already settled by the
 * member (debt lower than what is cancelled), the difference is refunded: method required.
 */
export function CancelPenaltyModal({ ids, total, label, debt, methods, onClose }: { ids: number[]; total: number; label: string; debt: number; methods: Option[]; onClose: () => void }) {
    const refund = Math.max(0, total - Math.max(0, debt));
    const form = useForm({ penalty_ids: ids, reason: '', refund_method: refund > 0 ? 'cash' : '', refund_reference: '' });

    return (
        <Modal
            open
            onClose={onClose}
            onSubmit={() => form.post('/penalties/cancel', { preserveScroll: true, onSuccess: onClose })}
            dirty={form.isDirty}
            errorBanner={formErrorBanner(form.errors)}
            title="Annuler une pénalité"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Retour</Button>
                    <Button type="submit" variant="danger" loading={form.processing}>
                        {refund > 0 ? `Annuler et rembourser ${fcfa(refund)}` : `Annuler ${fcfa(total)}`}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200/70">
                    {label} — <strong>{ids.length} pénalité(s), {fcfa(total)}</strong>
                </p>
                <Field label="Motif de l'annulation (obligatoire)" error={form.errors.reason ?? form.errors.penalty_ids}>
                    <Textarea autoFocus rows={3} value={form.data.reason} onChange={(e) => form.setData('reason', e.target.value)} placeholder="Ex. : retard dû au client (musique reçue le 12), validation tardive du studio…" />
                </Field>

                {refund > 0 && (
                    <div className="space-y-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                        <p className="text-sm text-amber-900">
                            Le membre a déjà réglé une partie de ces pénalités. Il ne doit plus que <strong>{fcfa(Math.max(0, debt))}</strong> : le studio doit lui rembourser <strong>{fcfa(refund)}</strong>.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Moyen de remboursement" error={form.errors.refund_method}>
                                <Select value={form.data.refund_method} onChange={(e) => form.setData('refund_method', e.target.value)}>
                                    {methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </Select>
                            </Field>
                            <Field label="Référence" error={form.errors.refund_reference}>
                                <Input value={form.data.refund_reference} onChange={(e) => form.setData('refund_reference', e.target.value)} placeholder="N° de transaction…" />
                            </Field>
                        </div>
                        <p className="text-xs text-amber-800">Un reçu de remboursement PDF sera généré. Le montant est déduit de la marge.</p>
                    </div>
                )}

                <p className="text-xs text-stone-500">La pénalité reste visible dans l'historique (barrée, avec le motif) mais n'est plus due. Elle ne sera pas recomptée. Le membre est prévenu.</p>
            </div>
        </Modal>
    );
}
