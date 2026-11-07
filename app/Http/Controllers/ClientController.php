<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Client;
use App\Support\Present;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ClientController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('q')->toString();
        $clients = Client::query()
            ->when($search, fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%$search%")->orWhere('phone', 'like', "%$search%")->orWhere('email', 'like', "%$search%")))
            ->withCount('projects')
            ->withSum('payments', 'amount')
            ->orderBy('name')
            ->paginate(20)->withQueryString()
            ->through(fn (Client $c) => [
                'id' => $c->id, 'name' => $c->name, 'phone' => $c->phone, 'email' => $c->email, 'address' => $c->address,
                'notes' => $c->notes, 'projects_count' => $c->projects_count, 'paid_total' => (int) $c->payments_sum_amount,
            ]);

        return Inertia::render('clients/index', ['clients' => $clients, 'filters' => ['q' => $search]]);
    }

    public function show(Request $request, Client $client): Response
    {
        $viewer = $request->user();

        return Inertia::render('clients/show', [
            'client' => $client->only(['id', 'name', 'phone', 'email', 'address', 'notes']),
            'projects' => $client->projects()->latest('event_date')->get()->map(function ($p) use ($viewer) {
                $p->setRelation('client', null);

                return [...Present::project($p, $viewer), 'paid' => $p->paidAmount(), 'remaining' => $p->remainingAmount()];
            }),
            'payments' => $client->payments()->with(['project', 'recorder'])->latest('paid_at')->get()->map(fn ($p) => Present::clientPayment($p, $viewer)),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $client = Client::create([...$this->validated($request), 'created_by' => $request->user()->id]);
        ActivityLog::record('created', "Client « {$client->name} » créé", $client);

        return back()->with('success', 'Client créé.');
    }

    public function update(Request $request, Client $client): RedirectResponse
    {
        $client->update($this->validated($request));
        ActivityLog::record('updated', "Client « {$client->name} » modifié", $client);

        return back()->with('success', 'Client mis à jour.');
    }

    public function destroy(Client $client): RedirectResponse
    {
        if ($client->projects()->exists()) {
            return back()->with('error', 'Ce client a des projets : archivez d\'abord ses projets.');
        }
        $client->delete();
        ActivityLog::record('deleted', "Client « {$client->name} » archivé", $client);

        return redirect('/clients')->with('success', 'Client archivé.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
    }
}
