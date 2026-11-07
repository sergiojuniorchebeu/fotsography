<?php

namespace App\Http\Controllers;

use App\Enums\ClientPaymentType;
use App\Enums\PaymentMethod;
use App\Enums\ProjectStatus;
use App\Models\ActivityLog;
use App\Models\Client;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Models\StudioSetting;
use App\Services\TemplateService;
use App\Support\Present;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $viewer = $request->user();
        $search = $request->string('q')->toString();
        $status = $request->string('status')->toString();

        $projects = Project::query()->with('client')
            ->withCount(['tasks', 'tasks as tasks_done_count' => fn ($q) => $q->where('status', 'done')])
            ->when($search, fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%$search%")->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%$search%"))))
            ->when($status, fn ($q) => $q->where('status', $status))
            ->orderByDesc('delivery_date')
            ->paginate(20)->withQueryString()
            ->through(function (Project $p) use ($viewer) {
                $data = Present::project($p, $viewer, true);
                if ($viewer->isAdmin()) {
                    $data['paid'] = $p->paidAmount();
                }

                return $data;
            });

        return Inertia::render('projects/index', [
            'projects' => $projects,
            'filters' => ['q' => $search, 'status' => $status],
            'statuses' => ProjectStatus::options(),
            'clients' => $viewer->isAdmin() ? Client::orderBy('name')->get(['id', 'name']) : [],
            'defaults' => $this->planDefaults(),
            'templates' => $viewer->isAdmin() && config('studio.templates') ? ProjectTemplate::orderBy('name')->get(['id', 'name']) : [],
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        $viewer = $request->user();
        $project->load('client');
        $settings = StudioSetting::current();

        $activities = $project->activities()->with(['tasks' => fn ($q) => $q->with(['assignee', 'dependency.assignee'])->orderBy('due_date')])->orderBy('id')->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->name,
                'description' => $a->description,
                'tasks' => $a->tasks->map(fn ($t) => Present::task($t, $viewer)),
                'expenses' => $viewer->isAdmin() ? $a->expenses()->with('recorder')->latest('spent_at')->get()->map(fn ($e) => [
                    'id' => $e->id, 'description' => $e->description, 'supplier' => $e->supplier, 'amount' => $e->amount,
                    'spent_at' => $e->spent_at->toDateString(), 'recorded_by' => $e->recorder?->nameFor($viewer),
                ]) : [],
            ]);

        $members = Present::assignable();
        $data = [
            'project' => Present::project($project, $viewer),
            'activities' => $activities,
            'members' => $members,
            'templates' => config('studio.templates') ? TemplateService::previews($project, $members, $viewer->isAdmin()) : [],
            'shareLeft' => $viewer->isAdmin() ? TemplateService::shareLeft($project) : null,
            'siblings' => TaskController::siblings($project, null, $viewer),
            'defaultTaskDueDate' => $project->clampTaskDate($project->delivery_date->subDays($settings->task_delivery_offset_days))->toDateString(),
            'statuses' => ProjectStatus::options(),
        ];

        if ($viewer->isAdmin()) {
            $plan = $project->plan();
            $payments = $project->payments()->with('recorder')->latest('paid_at')->get();
            $data['plan'] = collect([ClientPaymentType::Advance, ClientPaymentType::Intermediate, ClientPaymentType::Balance])->map(fn ($t) => [
                'type' => $t->value,
                'label' => $t->label(),
                'amount' => $plan[$t->value],
                'paid' => $payments->firstWhere('type', $t) !== null,
            ]);
            $data['payments'] = $payments->map(fn ($p) => Present::clientPayment($p, $viewer));
            $data['financials'] = $project->financials();
            $data['invoice'] = $project->invoice ? ['id' => $project->invoice->id, 'number' => $project->invoice->number, 'issued_at' => $project->invoice->issued_at->toIso8601String()] : null;
            $data['clients'] = Client::orderBy('name')->get(['id', 'name']);
            $data['methods'] = PaymentMethod::options();
            $data['memberPayments'] = $project->memberPayments()->with(['user', 'task', 'payer'])->latest('paid_at')->get()->map(fn ($p) => Present::memberPayment($p, $viewer));
        }

        return Inertia::render('projects/show', $data);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $template = $request->integer('template_id') ?: null;
        $project = Project::create([...$data, 'created_by' => $request->user()->id]);
        ActivityLog::record('created', "Projet « {$project->name} » créé", $project, ['total_amount' => $project->total_amount]);

        // With a template: open the project with the template ready to confirm (who does what, when).
        if ($template && config('studio.templates') && ProjectTemplate::whereKey($template)->exists()) {
            return redirect("/projects/{$project->id}?template={$template}")->with('success', 'Projet créé. Vérifiez qui fait quoi, puis créez les tâches.');
        }

        return redirect("/projects/{$project->id}")->with('success', 'Projet créé.');
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        $data = $this->validated($request, $project);
        $before = $project->only(array_keys($data));
        $project->update($data);
        ActivityLog::record('updated', "Projet « {$project->name} » modifié", $project, ['avant' => $before, 'après' => $project->only(array_keys($data))]);

        return back()->with('success', 'Projet mis à jour.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        if ($project->payments()->exists() || $project->memberPayments()->exists()) {
            return back()->with('error', 'Ce projet a des paiements enregistrés : passez-le plutôt en « Annulé ».');
        }
        $project->tasks()->delete();
        $project->activities()->delete();
        $project->delete();
        ActivityLog::record('deleted', "Projet « {$project->name} » archivé", $project);

        return redirect('/projects')->with('success', 'Projet archivé.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?Project $project = null): array
    {
        $data = $request->validate([
            'client_id' => ['required', 'exists:clients,id'],
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'event_date' => ['nullable', 'date', 'after_or_equal:start_date', 'before_or_equal:delivery_date'],
            'start_date' => ['required', 'date'],
            'delivery_date' => ['required', 'date', 'after_or_equal:start_date'],
            'total_amount' => ['required', 'integer', 'min:0'],
            'advance_pct' => ['required', 'integer', 'between:0,100'],
            'intermediate_pct' => ['required', 'integer', 'between:0,100'],
            'balance_pct' => ['required', 'integer', 'between:0,100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::enum(ProjectStatus::class)],
        ]);

        if ($data['advance_pct'] + $data['intermediate_pct'] + $data['balance_pct'] !== 100) {
            throw ValidationException::withMessages(['advance_pct' => 'La somme des pourcentages du plan doit faire 100 %.']);
        }

        if ($project) {
            $outsideTasks = $project->tasks()
                ->where(fn ($q) => $q->whereDate('due_date', '<', $data['start_date'])->orWhereDate('due_date', '>', $data['delivery_date']))
                ->count();
            if ($outsideTasks > 0) {
                throw ValidationException::withMessages(['delivery_date' => 'Les nouvelles dates du projet laisseraient '.$outsideTasks.' tâche(s) hors de sa durée. Modifiez d’abord leurs échéances.']);
            }
            $shares = (int) $project->tasks()->sum('client_share');
            if ($data['total_amount'] < $shares) {
                throw ValidationException::withMessages(['total_amount' => 'Le montant ne peut pas être inférieur au total des parts client des tâches ('.number_format($shares, 0, ',', ' ').' FCFA).']);
            }
            $paid = $project->paidAmount();
            if ($data['total_amount'] < $paid) {
                throw ValidationException::withMessages(['total_amount' => 'Le montant ne peut pas être inférieur à ce qui a déjà été encaissé.']);
            }
        }

        return $data;
    }

    /** @return array<string, int> */
    private function planDefaults(): array
    {
        $s = StudioSetting::current();

        return ['advance_pct' => $s->plan_advance_pct, 'intermediate_pct' => $s->plan_intermediate_pct, 'balance_pct' => $s->plan_balance_pct];
    }

    /**
     * "Détail de la facture": how the project price is split between its tasks (shown as invoice lines).
     * Tasks left out get no line; an empty list means the invoice shows the global amount only.
     */
    public function invoiceLines(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate(['lines' => ['present', 'array'], 'lines.*' => ['nullable', 'integer', 'min:0']]);
        $lines = collect($data['lines'])->map(fn ($v) => (int) $v);
        $tasks = $project->tasks()->get()->keyBy('id');
        if ($lines->keys()->diff($tasks->keys())->isNotEmpty()) {
            throw ValidationException::withMessages(['lines' => 'Une des tâches n\'appartient pas à ce projet.']);
        }
        if ($lines->sum() > $project->total_amount) {
            throw ValidationException::withMessages(['lines' => 'Le total ('.number_format($lines->sum(), 0, ',', ' ').' FCFA) dépasse le prix du projet ('.number_format($project->total_amount, 0, ',', ' ').' FCFA).']);
        }
        DB::transaction(function () use ($tasks, $lines) {
            foreach ($tasks as $id => $task) {
                $task->update(['client_share' => $lines->get($id, 0)]);
            }
        });
        ActivityLog::record('updated', "Détail de la facture du projet « {$project->name} » mis à jour", $project);

        return back()->with('success', $lines->sum() ? 'Détail de la facture enregistré.' : 'La facture affichera le montant global.');
    }
}
