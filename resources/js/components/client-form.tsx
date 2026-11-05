import { useForm } from '@inertiajs/react';
import { Button, Field, Input, Modal, Textarea, formErrorBanner } from '@/components/ui';

export type ClientData = { id?: number; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null };

export function ClientFormModal({ open, onClose, client }: { open: boolean; onClose: () => void; client?: ClientData }) {
    const form = useForm({
        name: client?.name ?? '',
        phone: client?.phone ?? '',
        email: client?.email ?? '',
        address: client?.address ?? '',
        notes: client?.notes ?? '',
    });

    const submit = () => {
        const opts = { preserveScroll: true, onSuccess: () => { onClose(); if (!client) { form.reset(); } } };
        if (client?.id) {
            form.put(`/clients/${client.id}`, opts);
        } else {
            form.post('/clients', opts);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)}
            title={client ? 'Modifier le client' : 'Nouveau client'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" loading={form.processing}>Enregistrer</Button>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom" error={form.errors.name} className="sm:col-span-2">
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                </Field>
                <Field label="Téléphone" error={form.errors.phone}>
                    <Input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} placeholder="+237 6XX XX XX XX" />
                </Field>
                <Field label="Email" error={form.errors.email}>
                    <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                </Field>
                <Field label="Adresse" error={form.errors.address} className="sm:col-span-2">
                    <Input value={form.data.address} onChange={(e) => form.setData('address', e.target.value)} placeholder="Quartier, ville" />
                </Field>
                <Field label="Notes" error={form.errors.notes} className="sm:col-span-2">
                    <Textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} />
                </Field>
            </div>
        </Modal>
    );
}
