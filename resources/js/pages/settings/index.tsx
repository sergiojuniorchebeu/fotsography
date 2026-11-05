import { useForm } from '@inertiajs/react';
import { Button, Card, Checkbox, Field, Input, MoneyInput, PageHeader } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';

type Settings = {
    studio_name: string; address: string | null; phone: string | null; email: string | null; niu_rccm: string | null; logo_url: string | null;
    receipt_prefix: string; plan_advance_pct: number; plan_intermediate_pct: number; plan_balance_pct: number;
    task_delivery_offset_days: number; penalties_enabled: boolean; penalty_amount: number; penalty_interval_days: number;
};

export default function SettingsPage({ settings: s }: { settings: Settings }) {
    const form = useForm({
        studio_name: s.studio_name, address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '', niu_rccm: s.niu_rccm ?? '',
        receipt_prefix: s.receipt_prefix, plan_advance_pct: s.plan_advance_pct, plan_intermediate_pct: s.plan_intermediate_pct, plan_balance_pct: s.plan_balance_pct,
        task_delivery_offset_days: s.task_delivery_offset_days, penalties_enabled: s.penalties_enabled, penalty_amount: s.penalty_amount as number | '', penalty_interval_days: s.penalty_interval_days,
        logo: null as File | null, remove_logo: false,
    });
    const pctSum = Number(form.data.plan_advance_pct) + Number(form.data.plan_intermediate_pct) + Number(form.data.plan_balance_pct);
    const year = new Date().getFullYear();

    return (
        <AppLayout title="Réglages">
            <PageHeader title="Réglages du studio" />
            <form noValidate
                className="space-y-6"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.transform((d) => ({ ...d, penalty_amount: Number(d.penalty_amount || 0), penalties_enabled: d.penalties_enabled ? 1 : 0, remove_logo: d.remove_logo ? 1 : 0 }));
                    form.post('/settings', { preserveScroll: true, forceFormData: true, onSuccess: () => form.setData('logo', null) });
                }}
            >
                <Card title="Identité du studio">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Nom du studio" error={form.errors.studio_name}><Input value={form.data.studio_name} onChange={(e) => form.setData('studio_name', e.target.value)} /></Field>
                        <Field label="NIU / RCCM" error={form.errors.niu_rccm}><Input value={form.data.niu_rccm} onChange={(e) => form.setData('niu_rccm', e.target.value)} /></Field>
                        <Field label="Adresse" error={form.errors.address} className="sm:col-span-2"><Input value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} /></Field>
                        <Field label="Téléphone" error={form.errors.phone}><Input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} /></Field>
                        <Field label="Email" error={form.errors.email}><Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} /></Field>
                        <Field label="Logo" error={form.errors.logo} className="sm:col-span-2" hint="PNG ou JPG, 2 Mo maximum. Apparaît sur les reçus et factures.">
                            <div className="flex flex-wrap items-center gap-4">
                                {s.logo_url && !form.data.remove_logo && <img src={s.logo_url} alt="Logo" className="h-14 rounded-lg bg-white object-contain p-1 ring-1 ring-stone-200" />}
                                <input type="file" accept="image/*" onChange={(e) => form.setData('logo', e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200" />
                                {s.logo_url && <Checkbox label="Retirer le logo" checked={form.data.remove_logo} onChange={(v) => form.setData('remove_logo', v)} />}
                            </div>
                        </Field>
                    </div>
                </Card>

                <Card title="Reçus et paiements">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Préfixe des numéros" error={form.errors.receipt_prefix} hint={`Exemple : ${form.data.receipt_prefix || 'FST'}-${year}-00001`}>
                            <Input value={form.data.receipt_prefix} onChange={(e) => form.setData('receipt_prefix', e.target.value.toUpperCase())} maxLength={10} />
                        </Field>
                        <div className="sm:col-span-2">
                            <p className="mb-2 text-sm font-medium text-stone-700">Plan de paiement par défaut</p>
                            <div className="grid grid-cols-3 gap-3">
                                <Field label="Avance (%)"><Input type="number" min={0} max={100} value={form.data.plan_advance_pct} onChange={(e) => form.setData('plan_advance_pct', Number(e.target.value))} /></Field>
                                <Field label="Intermédiaire (%)"><Input type="number" min={0} max={100} value={form.data.plan_intermediate_pct} onChange={(e) => form.setData('plan_intermediate_pct', Number(e.target.value))} /></Field>
                                <Field label="Solde (%)"><Input type="number" min={0} max={100} value={form.data.plan_balance_pct} onChange={(e) => form.setData('plan_balance_pct', Number(e.target.value))} /></Field>
                            </div>
                            {(form.errors.plan_advance_pct || pctSum !== 100) && <p className="mt-1 text-xs font-medium text-red-600">{form.errors.plan_advance_pct ?? `Total : ${pctSum} % (doit faire 100 %)`}</p>}
                        </div>
                    </div>
                </Card>

                <Card title="Tâches">
                    <Field label="Délai de livraison des tâches (jours avant la livraison globale)" error={form.errors.task_delivery_offset_days} className="sm:max-w-sm">
                        <Input type="number" min={0} value={form.data.task_delivery_offset_days} onChange={(e) => form.setData('task_delivery_offset_days', Number(e.target.value))} />
                    </Field>
                </Card>

                <Card title="Pénalités de retard">
                    <div className="space-y-4">
                        <Checkbox label="Activer le module de pénalités" checked={form.data.penalties_enabled} onChange={(v) => form.setData('penalties_enabled', v)} />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Montant par pénalité" error={form.errors.penalty_amount}><MoneyInput value={form.data.penalty_amount} onChange={(v) => form.setData('penalty_amount', v)} /></Field>
                            <Field label="Rythme (une pénalité tous les N jours)" error={form.errors.penalty_interval_days}><Input type="number" min={1} value={form.data.penalty_interval_days} onChange={(e) => form.setData('penalty_interval_days', Number(e.target.value))} /></Field>
                        </div>
                        <p className="text-xs text-stone-500">Première pénalité dès le 1er jour de retard, puis une nouvelle tous les N jours tant que le travail n'est pas envoyé. Désactiver le module n'efface pas les dettes existantes, et la période désactivée n'est jamais facturée après réactivation.</p>
                    </div>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" loading={form.processing}>Enregistrer les réglages</Button>
                </div>
            </form>
        </AppLayout>
    );
}
