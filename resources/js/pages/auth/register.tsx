import { useForm } from '@inertiajs/react';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import GuestLayout from '@/layouts/guest-layout';

export default function Register() {
    const form = useForm({ name: '', email: '', phone: '', password: '', password_confirmation: '' });

    return (
        <GuestLayout title="Premier lancement" subtitle="Créez le compte administrateur du studio. Les autres comptes seront créés depuis l'espace Équipe.">
            <form noValidate
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/register');
                }}
            >
                <Field label="Nom complet" error={form.errors.name}>
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                </Field>
                <Field label="Email" error={form.errors.email}>
                    <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                </Field>
                <Field label="Téléphone" error={form.errors.phone}>
                    <Input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} placeholder="+237 6XX XX XX XX" />
                </Field>
                <Field label="Mot de passe" error={form.errors.password} hint="8 caractères minimum, avec des lettres et des chiffres.">
                    <PasswordInput autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                </Field>
                <Field label="Confirmer le mot de passe">
                    <PasswordInput autoComplete="new-password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} />
                </Field>
                <Button type="submit" className="w-full" loading={form.processing}>
                    Créer le compte administrateur
                </Button>
            </form>
        </GuestLayout>
    );
}
