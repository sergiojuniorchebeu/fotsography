import { router, useForm, usePage } from '@inertiajs/react';
import { Button, Field, PasswordInput } from '@/components/ui';
import GuestLayout from '@/layouts/guest-layout';

export default function ChangePassword() {
    const { auth } = usePage().props;
    const forced = auth.user?.must_change_password;
    const form = useForm({ current_password: '', password: '', password_confirmation: '' });

    return (
        <GuestLayout
            title={forced ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
            subtitle={forced ? 'Vous utilisez un mot de passe provisoire. Choisissez-en un nouveau pour continuer.' : undefined}
        >
            <form noValidate
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put('/password/change', { onFinish: () => form.reset() });
                }}
            >
                <Field label={forced ? 'Mot de passe provisoire' : 'Mot de passe actuel'} error={form.errors.current_password}>
                    <PasswordInput autoFocus autoComplete="current-password" value={form.data.current_password} onChange={(e) => form.setData('current_password', e.target.value)} />
                </Field>
                <Field label="Nouveau mot de passe" error={form.errors.password} hint="8 caractères minimum, avec des lettres et des chiffres.">
                    <PasswordInput autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                </Field>
                <Field label="Confirmer le nouveau mot de passe">
                    <PasswordInput autoComplete="new-password" value={form.data.password_confirmation} onChange={(e) => form.setData('password_confirmation', e.target.value)} />
                </Field>
                <Button type="submit" className="w-full" loading={form.processing}>
                    Enregistrer
                </Button>
                <div className="flex justify-between text-xs">
                    {!forced && (
                        <button type="button" className="text-stone-500 hover:text-stone-900" onClick={() => window.history.back()}>
                            ← Retour
                        </button>
                    )}
                    <button type="button" className="ml-auto text-stone-500 hover:text-stone-900" onClick={() => router.post('/logout')}>
                        Se déconnecter
                    </button>
                </div>
            </form>
        </GuestLayout>
    );
}
