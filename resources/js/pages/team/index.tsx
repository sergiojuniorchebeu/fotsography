import { confirmDialog } from '@/components/confirm-dialog';
import { router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, Check, Copy, KeyRound, Mail, MailCheck, MessageSquareText, Pencil, Plus, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Td, Th, copyText, formErrorBanner } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { fcfa, relative } from '@/lib/format';
import type { Option } from '@/types';

type Row = { id: number; name: string; email: string; phone: string | null; role: string; role_label: string; is_active: boolean; must_change_password: boolean; last_login_at: string | null; tasks_count: number; tasks_open_count: number; penalty_debt: number };

function MemberModal({ user, roles, onClose }: { user?: Row; roles: Option[]; onClose: () => void }) {
    const form = useForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', role: user?.role ?? 'photographe' });
    const submit = () => {
        if (user) {
            form.put(`/team/${user.id}`, { preserveScroll: true, onSuccess: onClose });
        } else {
            form.post('/team', { preserveScroll: true, onSuccess: onClose });
        }
    };
    return (
        <Modal open onClose={onClose} onSubmit={submit} dirty={form.isDirty} errorBanner={formErrorBanner(form.errors)} title={user ? 'Modifier le membre' : 'Nouveau membre'} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit" loading={form.processing}>{user ? 'Enregistrer' : 'Créer le compte'}</Button></>}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom complet" error={form.errors.name} className="sm:col-span-2" hint="Sert aussi d'identifiant de connexion.">
                    <Input autoFocus value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                </Field>
                <Field label="Email" error={form.errors.email}>
                    <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                </Field>
                <Field label="Téléphone" error={form.errors.phone}>
                    <Input value={form.data.phone} onChange={(e) => form.setData('phone', e.target.value)} />
                </Field>
                <Field label="Rôle" error={form.errors.role} className="sm:col-span-2">
                    <Select value={form.data.role} disabled={user?.role === 'super_admin'} onChange={(e) => form.setData('role', e.target.value)}>
                        {user?.role === 'super_admin' && <option value="super_admin">Super Admin · Développeur</option>}
                        {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                </Field>
                {!user && <p className="text-xs text-stone-500 sm:col-span-2">Un mot de passe provisoire sera généré, envoyé par email au membre et affiché une seule fois pour que vous puissiez aussi le copier. Le membre devra le changer à sa première connexion.</p>}
            </div>
        </Modal>
    );
}

type Credentials = { id: number; name: string; email: string; phone: string | null; password: string; new: boolean; login_url: string; mail_sent: boolean };

function CopyButton({ text, label, variant = 'secondary' }: { text: string; label: string; variant?: 'primary' | 'secondary' }) {
    const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');
    useEffect(() => {
        if (state === 'idle') return;
        const id = window.setTimeout(() => setState('idle'), 2000);
        return () => window.clearTimeout(id);
    }, [state]);
    return (
        <Button variant={variant} onClick={async () => setState((await copyText(text)) ? 'ok' : 'fail')}>
            {state === 'ok' ? <Check className="size-4" /> : label.startsWith('Copier le message') ? <MessageSquareText className="size-4" /> : <Copy className="size-4" />}
            {state === 'ok' ? 'Copié' : state === 'fail' ? 'Sélectionnez puis copiez' : label}
        </Button>
    );
}

/** Shown once, right after creating a member or resetting a password. */
function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
    const [sending, setSending] = useState(false);
    const resend = () => router.post(`/team/${creds.id}/send-access`, { password: creds.password }, { preserveScroll: true, onStart: () => setSending(true), onFinish: () => setSending(false) });
    const message = [
        `Bonjour ${creds.name},`,
        creds.new ? 'Votre compte Fotsography Studio est prêt.' : 'Votre mot de passe Fotsography Studio a été réinitialisé.',
        `Lien : ${creds.login_url}`,
        `Identifiant : ${creds.email}`,
        `Mot de passe provisoire : ${creds.password}`,
        'Vous choisirez votre propre mot de passe à la première connexion.',
    ].join('\n');
    return (
        <Modal open onClose={onClose} size="sm" title={creds.new ? 'Compte créé' : 'Nouveau mot de passe'} description={<>Transmettez ces accès à <strong>{creds.name}</strong>. Le mot de passe ne sera plus affiché après fermeture.</>} footer={<Button onClick={onClose}>C'est noté</Button>}>
            <div className="space-y-4">
                <div className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm ring-1 ${creds.mail_sent ? 'bg-emerald-50 text-emerald-900 ring-emerald-100' : 'bg-amber-50 text-amber-900 ring-amber-100'}`}>
                    {creds.mail_sent ? <MailCheck className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                    <p className="min-w-0 flex-1">
                        {creds.mail_sent ? <>Email envoyé à <strong className="break-all">{creds.email}</strong>. Si rien n'arrive, pensez au dossier spam.</> : <>L'email n'a pas pu partir. Copiez le message ci-dessous et envoyez-le par WhatsApp, ou réessayez.</>}
                    </p>
                    <button type="button" onClick={resend} disabled={sending} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline disabled:opacity-50">
                        <Mail className="size-3.5" />{sending ? 'Envoi…' : creds.mail_sent ? 'Renvoyer' : 'Réessayer'}
                    </button>
                </div>
                <div>
                    <p className="mb-1 text-xs font-medium text-stone-500">Identifiant</p>
                    <p className="text-sm text-stone-800">{creds.email} <span className="text-stone-400">(ou « {creds.name} »)</span></p>
                </div>
                <div>
                    <p className="mb-1 text-xs font-medium text-stone-500">Mot de passe provisoire</p>
                    <div className="flex items-center gap-2">
                        <code className="tabular flex-1 rounded-lg bg-stone-100 px-3 py-2.5 font-mono text-lg tracking-wider text-stone-900 select-all">{creds.password}</code>
                        <CopyButton text={creds.password} label="Copier" variant="primary" />
                    </div>
                </div>
                <div className="rounded-lg bg-stone-50 p-3 ring-1 ring-stone-100">
                    <p className="mb-2 text-xs text-stone-500">Ou copiez le message complet à coller dans WhatsApp ou un SMS :</p>
                    <pre className="mb-3 text-xs whitespace-pre-wrap text-stone-700 select-all">{message}</pre>
                    <CopyButton text={message} label="Copier le message" />
                </div>
            </div>
        </Modal>
    );
}

export default function Team({ users, roles }: { users: Row[]; roles: Option[] }) {
    const me = usePage().props.auth.user!;
    const [modal, setModal] = useState<{ user?: Row } | null>(null);
    const flashCreds = usePage().props.flash.credentials;
    const [creds, setCreds] = useState<Credentials | null>(flashCreds);
    useEffect(() => {
        if (flashCreds) setCreds(flashCreds);
    }, [flashCreds]);

    return (
        <AppLayout title="Équipe">
            <PageHeader title="Équipe" subtitle={`${users.filter((u) => u.is_active).length} compte(s) actif(s)`} actions={<Button onClick={() => setModal({})}><Plus className="size-4" />Nouveau membre</Button>} />
            <Card bodyClassName="p-5 pt-2">
                <Table>
                    <thead><tr><Th>Membre</Th><Th>Rôle</Th><Th className="text-right">Tâches ouvertes</Th><Th className="text-right">Pénalités dues</Th><Th>Dernière connexion</Th><Th /></tr></thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                                <Td>
                                    <p className="font-medium">{u.name} {u.id === me.id && <span className="text-xs text-stone-400">(vous)</span>}</p>
                                    <p className="text-xs text-stone-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                                </Td>
                                <Td>
                                    <span className="flex flex-wrap gap-1">
                                        <Badge tone={u.role === 'super_admin' ? 'amber' : u.role === 'admin' ? 'violet' : u.role === 'assistant' ? 'blue' : 'stone'}>{u.role_label}</Badge>
                                        {!u.is_active && <Badge tone="red">Désactivé</Badge>}
                                        {u.must_change_password && <Badge tone="amber">Mot de passe provisoire</Badge>}
                                    </span>
                                </Td>
                                <Td className="tabular text-right">{u.tasks_open_count} <span className="text-stone-400">/ {u.tasks_count}</span></Td>
                                <Td className={`tabular text-right ${u.penalty_debt ? 'text-red-600' : 'text-stone-400'}`}>{fcfa(u.penalty_debt)}</Td>
                                <Td className="text-stone-500">{u.last_login_at ? relative(u.last_login_at) : 'Jamais'}</Td>
                                <Td>
                                    <span className="flex justify-end gap-1">
                                        {(u.role !== 'super_admin' || me.is_super_admin) && <>
                                        <Button size="sm" variant="ghost" title="Modifier" onClick={() => setModal({ user: u })}><Pencil className="size-3.5" /></Button>
                                        <Button size="sm" variant="ghost" title="Réinitialiser le mot de passe" onClick={() => void confirmDialog({ title: 'Réinitialiser le mot de passe', tone: 'primary', confirmLabel: 'Générer un mot de passe', message: <>Un nouveau mot de passe provisoire sera créé pour <strong>{u.name}</strong>, envoyé à {u.email} et affiché une seule fois. Son mot de passe actuel ne fonctionnera plus : un nouveau sera à choisir à la prochaine connexion.</>, request: { method: 'post', url: `/team/${u.id}/reset-password` } })}><KeyRound className="size-3.5" /></Button>
                                        {u.id !== me.id && (
                                            <Button size="sm" variant="ghost" title={u.is_active ? 'Désactiver' : 'Réactiver'} onClick={() => void confirmDialog(u.is_active ? { title: 'Désactiver le compte', confirmLabel: 'Désactiver', message: <><strong>{u.name}</strong> ne pourra plus se connecter. Ses tâches, paiements et pénalités restent dans l'historique. Vous pourrez réactiver le compte à tout moment.</>, request: { method: 'post', url: `/team/${u.id}/toggle` } } : { title: 'Réactiver le compte', tone: 'primary', confirmLabel: 'Réactiver', message: <><strong>{u.name}</strong> pourra de nouveau se connecter.</>, request: { method: 'post', url: `/team/${u.id}/toggle` } })}>
                                                <Power className={`size-3.5 ${u.is_active ? 'text-red-600' : 'text-emerald-600'}`} />
                                            </Button>
                                        )}
                                        </>}
                                    </span>
                                </Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
            {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
            {modal && <MemberModal user={modal.user} roles={roles} onClose={() => setModal(null)} />}
        </AppLayout>
    );
}
