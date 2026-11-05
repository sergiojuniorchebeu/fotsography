import { useForm } from '@inertiajs/react';
import { Button, Checkbox, Field, Input, PasswordInput } from '@/components/ui';
import GuestLayout from '@/layouts/guest-layout';

export default function Login() {
    const form = useForm({ login: '', password: '', remember: true });

    return (
        <GuestLayout title="Connexion" subtitle="Connectez-vous avec votre email ou votre nom complet.">
            <form noValidate
                className="space-y-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post('/login', { onFinish: () => form.reset('password') });
                }}
            >
                <Field label="Email ou nom complet" error={form.errors.login}>
                    <Input autoFocus autoComplete="username" value={form.data.login} onChange={(e) => form.setData('login', e.target.value)} placeholder="ex. Jean Fotso" />
                </Field>
                <Field label="Mot de passe" error={form.errors.password}>
                    <PasswordInput autoComplete="current-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                </Field>
                <Checkbox label="Rester connecté" checked={form.data.remember} onChange={(v) => form.setData('remember', v)} />
                <Button type="submit" className="w-full" loading={form.processing}>
                    Se connecter
                </Button>
                <p className="text-center text-xs text-stone-500">Mot de passe oublié ? Demandez à l'administrateur de le réinitialiser.</p>
            </form>
        </GuestLayout>
    );
}
