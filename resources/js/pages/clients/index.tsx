import { Link, router } from '@inertiajs/react';
import { Plus, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ClientFormModal } from '@/components/client-form';
import { Button, Card, Empty, Input, PageHeader, Pagination, Table, Td, Th } from '@/components/ui';
import AppLayout from '@/layouts/app-layout';
import { fcfa } from '@/lib/format';
import type { Paginated } from '@/types';

type Row = { id: number; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; projects_count: number; paid_total: number };

export default function ClientsIndex({ clients, filters }: { clients: Paginated<Row>; filters: { q: string } }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState(filters.q ?? '');

    return (
        <AppLayout title="Clients">
            <PageHeader title="Clients" subtitle={`${clients.total} client(s)`} actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" />Nouveau client</Button>} />
            <Card bodyClassName="p-5 pt-4">
                <form noValidate className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); router.get('/clients', { q }, { preserveState: true }); }}>
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
                        <Input className="pl-9" placeholder="Nom, téléphone ou email…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <Button type="submit" variant="secondary">Rechercher</Button>
                </form>
                {clients.data.length === 0 ? (
                    <Empty icon={<UserRound className="size-10" />} title="Aucun client">Ajoutez votre premier client pour créer un projet.</Empty>
                ) : (
                    <Table>
                        <thead>
                            <tr><Th>Nom</Th><Th>Contact</Th><Th className="text-right">Projets</Th><Th className="text-right">Total payé</Th></tr>
                        </thead>
                        <tbody>
                            {clients.data.map((c) => (
                                <tr key={c.id} className="hover:bg-stone-50/60">
                                    <Td><Link href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>{c.address && <p className="text-xs text-stone-500">{c.address}</p>}</Td>
                                    <Td className="text-stone-600">{c.phone ?? '—'}{c.email && <p className="text-xs text-stone-500">{c.email}</p>}</Td>
                                    <Td className="tabular text-right">{c.projects_count}</Td>
                                    <Td className="tabular text-right">{fcfa(c.paid_total)}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
                <Pagination page={clients} />
            </Card>
            <ClientFormModal open={open} onClose={() => setOpen(false)} />
        </AppLayout>
    );
}
