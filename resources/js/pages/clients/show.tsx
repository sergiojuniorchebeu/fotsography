import { confirmDialog } from '@/components/confirm-dialog';
import { Link, router } from '@inertiajs/react';
import { Download, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ClientData } from '@/components/client-form';
import { ClientFormModal } from '@/components/client-form';
import { Badge, Button, Card, Empty, PageHeader, Stat, Table, Td, Th, projectTone } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { date, dateTime, fcfa } from '@/lib/format';
import type { ClientPayment, Project } from '@/types';

export default function ClientShow({ client, projects, payments }: { client: ClientData & { id: number }; projects: Project[]; payments: ClientPayment[] }) {
    const [edit, setEdit] = useState(false);
    const total = projects.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + (p.total_amount ?? 0), 0);
    const paid = payments.reduce((s, p) => s + p.amount, 0);

    return (
        <AppLayout title={client.name}>
            <PageHeader
                back={{ href: '/clients', label: 'Clients' }}
                title={client.name}
                subtitle={
                    <span className="flex flex-wrap gap-x-4 gap-y-1">
                        {client.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{client.phone}</span>}
                        {client.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{client.email}</span>}
                        {client.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{client.address}</span>}
                    </span>
                }
                actions={
                    <>
                        <Button variant="secondary" onClick={() => setEdit(true)}><Pencil className="size-4" />Modifier</Button>
                        <Button variant="ghost" onClick={() => void confirmDialog({ title: 'Archiver ce client', confirmLabel: 'Archiver', message: <>« {client.name} » ne sera plus listé. Rien n'est effacé : ses données restent dans l'historique. Un client qui a des projets ne peut pas être archivé.</>, request: { method: 'delete', url: `/clients/${client.id}` } })}><Trash2 className="size-4" />Archiver</Button>
                    </>
                }
            />
            {client.notes && <p className="mb-6 rounded-xl bg-white p-4 text-sm whitespace-pre-line text-stone-600 ring-1 ring-stone-200/70">{client.notes}</p>}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Montant des projets" value={fcfa(total)} />
                <Stat label="Total payé" value={fcfa(paid)} tone="positive" />
                <Stat label="Reste à payer" value={fcfa(Math.max(0, total - paid))} tone={total - paid > 0 ? 'warning' : undefined} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Card title={`Projets (${projects.length})`}>
                    {projects.length === 0 ? <Empty title="Aucun projet pour ce client." /> : (
                        <ul className="-my-2 divide-y divide-stone-100">
                            {projects.map((p) => (
                                <li key={p.id}>
                                    <Link href={`/projects/${p.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-stone-50">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{p.name}</p>
                                            <p className="text-xs text-stone-500">Événement {date(p.event_date)} · payé {fcfa(p.paid)} / {fcfa(p.total_amount)}</p>
                                        </div>
                                        <Badge tone={projectTone[p.status]}>{p.status_label}</Badge>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <Card title={`Paiements (${payments.length})`}>
                    {payments.length === 0 ? <Empty title="Aucun paiement enregistré." /> : (
                        <Table>
                            <thead><tr><Th>Reçu</Th><Th>Projet</Th><Th className="text-right">Montant</Th><Th /></tr></thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id}>
                                        <Td><p className="font-mono text-xs">{p.receipt_number}</p><p className="text-xs text-stone-500">{dateTime(p.paid_at)} · {p.type_label}</p></Td>
                                        <Td className="text-stone-600">{p.project?.name}</Td>
                                        <Td className="tabular text-right font-medium">{fcfa(p.amount)}</Td>
                                        <Td><a href={`/client-payments/${p.id}/receipt`} className="text-stone-400 hover:text-stone-900" title="Télécharger le reçu"><Download className="size-4" /></a></Td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card>
            </div>
            <ClientFormModal open={edit} onClose={() => setEdit(false)} client={client} />
        </AppLayout>
    );
}
