<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\TaskStatus;
use App\Models\Activity;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\User;
use App\Services\Money;
use App\Services\Notifier;
use App\Services\PenaltyService;
use App\Support\Present;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TaskController extends Controller
{
    /** Tabs of the task list. "active" = everything not finished. */
    private const VIEWS = ['active', 'review', 'late', 'waiting', 'done', 'all'];

    public function index(Request $request): Response
    {
        $viewer = $request->user();
        $filters = $request->only(['view', 'member', 'project']);
        $view = in_array($filters['view'] ?? null, self::VIEWS, true) ? $filters['view'] : 'active';

        $scoped = fn () => Task::query()
            ->when($viewer->isMember(), fn ($q) => $q->where('assigned_to', $viewer->id))
            ->when(! $viewer->isMember() && ! empty($filters['member']), fn ($q) => $q->where('assigned_to', $filters['member']))
            ->when(! empty($filters['project']), fn ($q) => $q->where('project_id', $filters['project']));

        $apply = fn ($q, string $v) => match ($v) {
            'active' => $q->where('status', '!=', TaskStatus::Done->value),
            'review' => $q->where('status', TaskStatus::Review->value),
            'late' => $q->late(),
            'waiting' => $q->waiting(),
            'done' => $q->where('status', TaskStatus::Done->value),
            default => $q,
        };

        $counts = collect(self::VIEWS)->mapWithKeys(fn ($v) => [$v => $apply($scoped(), $v)->count()]);

        $tasks = $apply($scoped(), $view)->with(['assignee', 'project', 'activity', 'dependency.assignee'])
            ->orderByRaw("CASE status WHEN 'review' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END")
            ->when($view === 'done', fn ($q) => $q->orderByDesc('validated_at'), fn ($q) => $q->orderBy('due_date'))
            ->paginate(30)->withQueryString()
            ->through(fn (Task $t) => Present::task($t, $viewer));

        return Inertia::render('tasks/index', [
            'tasks' => $tasks,
            'view' => $view,
            'counts' => $counts,
            'filters' => $filters,
            'workload' => $viewer->isMember() ? [] : Present::assignable()->filter(fn ($m) => $m['role'] !== 'assistant' || $m['open_count'] + $m['review_count'] > 0)->values(),
            'projects' => $viewer->isMember() ? [] : Project::whereIn('status', ['draft', 'in_progress'])->orderBy('delivery_date')->get(['id', 'name']),
        ]);
    }

    public function show(Request $request, Task $task): Response
    {
        $viewer = $request->user();
        abort_unless($viewer->isStaff() || $task->assigned_to === $viewer->id, 403);
        PenaltyService::accrue($task);
        $task->refresh()->load(['assignee', 'project', 'activity', 'dependency.assignee']);

        return Inertia::render('tasks/show', [
            'task' => Present::task($task, $viewer, true),
            'methods' => PaymentMethod::options(),
            'penaltyDebt' => $viewer->isAdmin() && $task->assignee ? $task->assignee->penaltyDebt() : null,
            'members' => $viewer->isStaff() ? Present::assignable() : [],
            'siblings' => $viewer->isStaff() ? self::siblings($task->project, $task, $viewer) : [],
            'dateBounds' => ['start' => $task->project->taskStartDate()->toDateString(), 'end' => $task->project->delivery_date->toDateString()],
        ]);
    }

    /** Other tasks of the project, for the "starts after" list. @return array<int, array<string, mixed>> */
    public static function siblings(Project $project, ?Task $except = null, ?User $viewer = null): array
    {
        return $project->tasks()->with(['assignee', 'activity'])
            ->when($except, fn ($q) => $q->whereKeyNot($except->id))
            ->orderBy('due_date')->get()
            ->map(fn (Task $t) => ['id' => $t->id, 'name' => $t->name, 'activity' => $t->activity?->name, 'assignee' => $t->assignee?->nameFor($viewer), 'due_date' => $t->due_date->toDateString(), 'status_label' => $t->status->label()])
            ->all();
    }

    public function store(Request $request, Activity $activity): RedirectResponse
    {
        return $this->create($request, $activity);
    }

    /** "Ajouter une tâche" from the project: pick an existing activity or name a new one on the fly. */
    public function storeInProject(Request $request, Project $project): RedirectResponse
    {
        $request->validate([
            'activity_id' => ['nullable', 'integer'],
            'activity_name' => ['nullable', 'required_without:activity_id', 'string', 'max:255'],
        ], ['activity_name.required_without' => 'Choisissez une activité ou donnez un nom à la nouvelle.']);

        if ($request->filled('activity_id')) {
            $activity = $project->activities()->whereKey($request->integer('activity_id'))->first();
            if (! $activity) {
                throw ValidationException::withMessages(['activity_id' => 'Choisissez une activité de ce projet.']);
            }
        } else {
            $name = trim((string) $request->input('activity_name'));
            $activity = $project->activities()->get()->first(fn (Activity $a) => mb_strtolower($a->name) === mb_strtolower($name));
            if (! $activity) {
                $this->validated($request, $project, null); // fail before creating an empty activity
                $activity = $project->activities()->create(['name' => $name, 'created_by' => $request->user()->id]);
                ActivityLog::record('created', "Activité « {$activity->name} » ajoutée au projet « {$project->name} »", $activity);
            }
        }

        return $this->create($request, $activity);
    }

    private function create(Request $request, Activity $activity): RedirectResponse
    {
        $viewer = $request->user();
        $project = $activity->project;
        $data = $this->validated($request, $project, null);

        $task = DB::transaction(function () use ($data, $activity, $project, $viewer) {
            $this->guardShares($project, (int) ($data['client_share'] ?? 0), null);

            return Task::create([
                ...$data,
                'activity_id' => $activity->id,
                'project_id' => $project->id,
                'status' => TaskStatus::Todo,
                'created_by' => $viewer->id,
            ]);
        });

        ActivityLog::record('created', "Tâche « {$task->name} » créée et assignée à ".($task->assignee?->name ?? 'personne'), $task);
        if ($task->assignee) {
            $this->notifyAssigned($task, true);
        }

        return back()->with('success', 'Tâche créée.');
    }

    public function update(Request $request, Task $task): RedirectResponse
    {
        $viewer = $request->user();
        if ($task->isLocked() && ! $viewer->isAdmin()) {
            return back()->with('error', 'Cette tâche est terminée et verrouillée.');
        }

        $project = $task->project;
        $data = $this->validated($request, $project, $task);
        $oldAssignee = $task->assigned_to;
        $oldDue = $task->due_date->toDateString();
        $wasWaiting = $task->isWaiting();

        DB::transaction(function () use ($task, $data, $project, $wasWaiting) {
            if (array_key_exists('client_share', $data)) {
                $this->guardShares($project, (int) $data['client_share'], $task);
            }
            if (array_key_exists('member_fee', $data) && $data['member_fee'] < $task->paidGross()) {
                throw ValidationException::withMessages(['member_fee' => 'La rémunération ne peut pas être inférieure à ce qui a déjà été versé ('.Money::fcfa($task->paidGross()).').']);
            }
            PenaltyService::accrue($task);
            $task->fill($data);
            $task->unsetRelation('dependency');
            if ($task->isDirty('due_date') || $task->isDirty('assigned_to') || ($wasWaiting && ! $task->isWaiting())) {
                PenaltyService::reanchor($task, true);
                $task->forceFill(['reminded_at' => null, 'overdue_notified_at' => null]);
            }
            $task->save();
        });

        ActivityLog::record('updated', "Tâche « {$task->name} » modifiée", $task, array_filter([
            'échéance' => $oldDue !== $task->due_date->toDateString() ? "$oldDue → {$task->due_date->toDateString()}" : null,
        ]));

        if ($task->assigned_to !== $oldAssignee) {
            $this->notifyAssigned($task);
        } elseif ($task->assigned_to !== $viewer->id) {
            Notifier::send($task->assignee, 'task_updated', 'Tâche modifiée',
                "« {$task->name} » a été mise à jour — échéance le {$task->due_date->format('d/m/Y')}.", "/tasks/{$task->id}");
        }

        return back()->with('success', 'Tâche mise à jour.');
    }

    public function destroy(Request $request, Task $task): RedirectResponse
    {
        if ($task->payments()->exists() || $task->penalties()->exists()) {
            return back()->with('error', 'Cette tâche a des paiements ou des pénalités : elle ne peut pas être supprimée.');
        }
        DB::transaction(function () use ($task) {
            $task->delete();
            $task->dependents()->get()->each(function (Task $d) {
                $d->depends_on_id = null;
                PenaltyService::reanchor($d, true);
                $d->save();
            });
        });
        ActivityLog::record('deleted', "Tâche « {$task->name} » archivée", $task);

        return back()->with('success', 'Tâche archivée.');
    }

    /** The member says "I'm on it": the admin sees who is working on what. */
    public function start(Request $request, Task $task): RedirectResponse
    {
        $viewer = $request->user();
        abort_unless($task->assigned_to === $viewer->id, 403);
        if ($task->status !== TaskStatus::Todo) {
            return back()->with('error', 'Cette tâche est déjà commencée.');
        }
        if ($task->isWaiting()) {
            return back()->with('error', "Attendez que « {$task->dependency->name} » soit validée.");
        }
        $task->update(['status' => TaskStatus::InProgress, 'started_at' => $task->started_at ?? now()]);
        TaskReview::create(['task_id' => $task->id, 'user_id' => $viewer->id, 'action' => 'started']);
        ActivityLog::record('updated', "{$viewer->name} a commencé « {$task->name} »", $task);

        return back()->with('success', 'C\'est parti ! Livrez votre travail ici une fois terminé.');
    }

    /** The member hands over the work: where the files are, and/or a message. */
    public function submit(Request $request, Task $task): RedirectResponse
    {
        $viewer = $request->user();
        abort_unless($task->assigned_to === $viewer->id, 403);
        if (! $task->status->isOpen()) {
            return back()->with('error', 'Ce travail a déjà été livré.');
        }
        if ($task->isWaiting()) {
            return back()->with('error', "Attendez que « {$task->dependency->name} » soit validée.");
        }
        $data = $request->validate([
            'proof_url' => ['nullable', 'url', 'max:2000'],
            'proof_note' => ['required_without:proof_url', 'nullable', 'string', 'max:5000'],
        ], [
            'proof_url.url' => 'Le lien doit commencer par https://… (copiez-le depuis Drive, WeTransfer…).',
            'proof_note.required_without' => 'Indiquez où trouver le travail : un lien, ou un message (ex. « fichiers copiés sur le disque du studio »).',
        ]);

        PenaltyService::accrue($task);
        DB::transaction(function () use ($task, $data, $viewer) {
            $task->update([
                'proof_url' => $data['proof_url'] ?? null,
                'proof_note' => $data['proof_note'] ?? null,
                'status' => TaskStatus::Review,
                'started_at' => $task->started_at ?? now(),
                'submitted_at' => now(),
            ]);
            TaskReview::create(['task_id' => $task->id, 'user_id' => $viewer->id, 'action' => 'submitted', 'proof_url' => $data['proof_url'] ?? null, 'comment' => $data['proof_note'] ?? null]);
        });
        ActivityLog::record('updated', "Travail livré pour vérification : « {$task->name} »", $task);
        Notifier::adminsNow('task_submitted', 'Travail à vérifier',
            "{$viewer->name} a livré « {$task->name} » ({$task->project->name}).", "/tasks/{$task->id}", $viewer);

        return back()->with('success', 'Travail livré : l\'administrateur va le vérifier.');
    }

    public function validateTask(Request $request, Task $task): RedirectResponse
    {
        if ($task->status !== TaskStatus::Review) {
            return back()->with('error', 'Seule une tâche en vérification peut être validée.');
        }
        $data = $request->validate(['comment' => ['nullable', 'string', 'max:5000']]);
        DB::transaction(function () use ($task, $data, $request) {
            $task->update(['status' => TaskStatus::Done, 'validated_at' => now(), 'validated_by' => $request->user()->id]);
            TaskReview::create(['task_id' => $task->id, 'user_id' => $request->user()->id, 'action' => 'validated', 'comment' => $data['comment'] ?? null]);
        });
        ActivityLog::record('updated', "Tâche « {$task->name} » validée", $task);
        $task->loadMissing('assignee');
        $hasPayableFee = $task->assignee && ! $task->assignee->isAdmin() && $task->remainingFee() > 0;
        Notifier::send($task->assignee, 'task_validated', 'Tâche validée ✅', "« {$task->name} » a été validée.", "/tasks/{$task->id}");

        // The next steps can start now: their late clock starts today, not from a past due date.
        $task->dependents()->with('assignee')->whereIn('status', TaskStatus::open())->get()->each(function (Task $next) use ($task) {
            PenaltyService::reanchor($next, true);
            $next->forceFill(['reminded_at' => null, 'overdue_notified_at' => null])->save();
            Notifier::send($next->assignee, 'task_unblocked', 'Vous pouvez commencer',
                "« {$task->name} » est validée : « {$next->name} » peut démarrer (à livrer le {$next->due_date->format('d/m/Y')}).", "/tasks/{$next->id}");
        });

        return back()->with('success', $hasPayableFee
            ? 'Tâche validée. La rémunération est maintenant à payer.'
            : 'Tâche validée et verrouillée.');
    }

    public function returnTask(Request $request, Task $task): RedirectResponse
    {
        if ($task->status !== TaskStatus::Review) {
            return back()->with('error', 'Seule une tâche en vérification peut être renvoyée.');
        }
        $data = $request->validate([
            'comment' => ['required', 'string', 'max:5000'],
            'corrections' => ['required', 'string', 'max:5000'],
        ], ['comment.required' => 'Le motif du renvoi est obligatoire.', 'corrections.required' => 'Indiquez les corrections demandées.']);

        DB::transaction(function () use ($task, $data, $request) {
            $task->status = TaskStatus::InProgress;
            PenaltyService::reanchor($task, true);
            $task->save();
            TaskReview::create(['task_id' => $task->id, 'user_id' => $request->user()->id, 'action' => 'returned', ...$data]);
        });
        ActivityLog::record('updated', "Tâche « {$task->name} » renvoyée pour corrections", $task, ['motif' => $data['comment']]);
        Notifier::send($task->assignee, 'task_returned', 'Tâche renvoyée',
            "« {$task->name} » doit être corrigée : {$data['comment']}", "/tasks/{$task->id}");

        return back()->with('success', 'Tâche renvoyée au membre.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, Project $project, ?Task $task): array
    {
        $viewer = $request->user();
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'instructions' => ['nullable', 'string', 'max:10000'],
            'assigned_to' => ['required', 'exists:users,id'],
            'due_date' => ['nullable', 'date'],
            'depends_on_id' => ['nullable', 'integer'],
        ];
        if ($viewer->isAdmin()) {
            $rules['client_share'] = ['nullable', 'integer', 'min:0'];
            $rules['member_fee'] = ['nullable', 'integer', 'min:0'];
        }
        $data = $request->validate($rules);

        $assignee = User::findOrFail($data['assigned_to']);
        if (! $assignee->is_active || $assignee->isSuperAdmin()) {
            throw ValidationException::withMessages(['assigned_to' => 'Choisissez un membre actif de l’équipe.']);
        }

        $data['depends_on_id'] = $this->checkedDependency($project, $task, $data['depends_on_id'] ?? null);

        $data['due_date'] = $data['due_date'] ?? $task?->due_date->toDateString()
            ?? $project->clampTaskDate($project->delivery_date->subDays(StudioSetting::current()->task_delivery_offset_days))->toDateString();

        $dueDate = CarbonImmutable::parse($data['due_date']);
        $startDate = $project->taskStartDate();
        if ($dueDate->lessThan($startDate) || $dueDate->greaterThan($project->delivery_date)) {
            throw ValidationException::withMessages(['due_date' => 'L’échéance doit être comprise entre le début du projet ('.$startDate->format('d/m/Y').') et la livraison au client ('.$project->delivery_date->format('d/m/Y').').']);
        }
        if ($data['depends_on_id']) {
            $dependency = $project->tasks()->find($data['depends_on_id']);
            if ($dependency && $dependency->due_date->greaterThan($dueDate)) {
                throw ValidationException::withMessages(['due_date' => 'La tâche doit être livrée après sa tâche précédente ('.$dependency->due_date->format('d/m/Y').').']);
            }
        }
        if ($task && $task->dependents()->whereDate('due_date', '<', $dueDate->toDateString())->exists()) {
            throw ValidationException::withMessages(['due_date' => 'Cette tâche doit rester avant l’échéance de la tâche qui en dépend.']);
        }

        if ($viewer->isAdmin()) {
            // The client share is set from "Détail de la facture" on the project; keep it unless sent.
            if ($request->has('client_share')) {
                $data['client_share'] = (int) ($data['client_share'] ?? 0);
            } else {
                unset($data['client_share']);
            }
            $data['member_fee'] = $assignee->isAdmin() ? 0 : (int) ($data['member_fee'] ?? 0);
        } elseif ($assignee->isAdmin() && $task) {
            $data['member_fee'] = 0;
        }

        return $data;
    }

    private function checkedDependency(Project $project, ?Task $task, mixed $id): ?int
    {
        if (! $id) {
            return null;
        }
        $dep = $project->tasks()->whereKey($id)->first();
        if (! $dep) {
            throw ValidationException::withMessages(['depends_on_id' => 'Choisissez une tâche du même projet.']);
        }
        // Walk up the chain: the task must not end up waiting on itself.
        for ($cur = $dep, $guard = 0; $cur && $guard < 100; $cur = $cur->dependency, $guard++) {
            if ($task && $cur->id === $task->id) {
                throw ValidationException::withMessages(['depends_on_id' => "Impossible : « {$dep->name} » attend déjà cette tâche."]);
            }
        }

        return $dep->id;
    }

    private function notifyAssigned(Task $task, bool $immediate = false): void
    {
        $task->loadMissing(['project', 'dependency']);
        $wait = $task->isWaiting() ? " Elle démarrera après « {$task->dependency->name} » : vous serez prévenu." : '';
        $send = $immediate ? [Notifier::class, 'sendNow'] : [Notifier::class, 'send'];
        $send($task->assignee, 'task_assigned', 'Nouvelle tâche assignée',
            "« {$task->name} » ({$task->project->name}) — à livrer le {$task->due_date->format('d/m/Y')}.$wait", "/tasks/{$task->id}");
    }

    private function guardShares(Project $project, int $share, ?Task $except): void
    {
        $others = (int) $project->tasks()->when($except, fn ($q) => $q->whereKeyNot($except->id))->sum('client_share');
        if ($others + $share > $project->total_amount) {
            throw ValidationException::withMessages(['client_share' => 'Le total des parts client ('.Money::fcfa($others + $share).') dépasse le montant du projet ('.Money::fcfa($project->total_amount).').']);
        }
    }
}
