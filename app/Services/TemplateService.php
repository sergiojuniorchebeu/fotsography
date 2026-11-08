<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TemplateService
{
    /**
     * Validate and clean a structure coming from the editor.
     *
     * @param  array<string, mixed>  $input
     * @return array{activities: array<int, array<string, mixed>>}
     */
    public static function normalize(array $input): array
    {
        validator($input, [
            'activities' => ['required', 'array', 'min:1'],
            'activities.*.name' => ['required', 'string', 'max:255'],
            'activities.*.tasks' => ['required', 'array', 'min:1'],
            'activities.*.tasks.*.key' => ['required', 'string', 'max:40'],
            'activities.*.tasks.*.name' => ['required', 'string', 'max:255'],
            'activities.*.tasks.*.instructions' => ['nullable', 'string', 'max:10000'],
            'activities.*.tasks.*.role' => ['nullable', Rule::in(array_column(Role::options(), 'value'))],
            'activities.*.tasks.*.from' => ['required', 'in:event,delivery'],
            'activities.*.tasks.*.days' => ['required', 'integer', 'between:0,365'],
            'activities.*.tasks.*.member_fee' => ['nullable', 'integer', 'min:0'],
            'activities.*.tasks.*.client_pct' => ['nullable', 'integer', 'between:0,100'],
            'activities.*.tasks.*.after' => ['nullable', 'string', 'max:40'],
        ], [
            'activities.required' => 'Ajoutez au moins une activité.',
            'activities.*.name.required' => 'Chaque activité doit avoir un nom.',
            'activities.*.tasks.required' => 'Chaque activité doit contenir au moins une tâche.',
            'activities.*.tasks.min' => 'Chaque activité doit contenir au moins une tâche.',
            'activities.*.tasks.*.name.required' => 'Chaque tâche doit avoir un nom.',
        ])->validate();

        $activities = [];
        $after = [];
        $pct = 0;
        foreach ($input['activities'] as $a) {
            $tasks = [];
            foreach ($a['tasks'] as $t) {
                $key = (string) $t['key'];
                if (isset($after[$key])) {
                    throw ValidationException::withMessages(['activities' => 'Deux tâches ont le même identifiant.']);
                }
                $after[$key] = $t['after'] ?? null ?: null;
                $pct += (int) ($t['client_pct'] ?? 0);
                $tasks[] = [
                    'key' => $key,
                    'name' => trim($t['name']),
                    'instructions' => $t['instructions'] ?? null ?: null,
                    'role' => $t['role'] ?? null ?: null,
                    'from' => $t['from'],
                    'days' => (int) $t['days'],
                    'member_fee' => (int) ($t['member_fee'] ?? 0),
                    'client_pct' => (int) ($t['client_pct'] ?? 0),
                    'after' => $after[$key],
                ];
            }
            $activities[] = ['name' => trim($a['name']), 'tasks' => $tasks];
        }

        if ($pct > 100) {
            throw ValidationException::withMessages(['activities' => "Le total des parts client fait {$pct} % : il ne peut pas dépasser 100 %."]);
        }
        foreach ($after as $key => $dep) {
            if ($dep !== null && ! array_key_exists($dep, $after)) {
                throw ValidationException::withMessages(['activities' => 'Une tâche « commence après » une tâche qui n\'existe plus.']);
            }
            for ($cur = $dep, $i = 0; $cur !== null && $i < 200; $cur = $after[$cur] ?? null, $i++) {
                if ($cur === $key) {
                    throw ValidationException::withMessages(['activities' => 'Deux tâches s\'attendent l\'une l\'autre : corrigez les « commence après ».']);
                }
            }
        }

        return ['activities' => $activities];
    }

    /** Due date of a template task for this project. */
    public static function dueDate(array $task, Project $project): CarbonImmutable
    {
        if ($task['from'] === 'event' && $project->event_date) {
            return $project->clampTaskDate(CarbonImmutable::parse($project->event_date)->addDays($task['days']));
        }
        if ($task['from'] === 'event') {
            // No event date yet: fall back to the usual delay before the delivery.
            return $project->clampTaskDate(CarbonImmutable::parse($project->delivery_date)->subDays(StudioSetting::current()->task_delivery_offset_days));
        }

        return $project->clampTaskDate(CarbonImmutable::parse($project->delivery_date)->subDays($task['days']));
    }

    /**
     * What applying each template would create on this project: dates computed,
     * and for each task the least busy active person with the right role.
     *
     * @param  Collection<int, array<string, mixed>>  $members  output of Present::assignable()
     * @return array<int, array<string, mixed>>
     */
    public static function previews(Project $project, Collection $members, bool $withMoney): array
    {
        return ProjectTemplate::orderBy('name')->get()->map(function (ProjectTemplate $tpl) use ($project, $members, $withMoney) {
            $load = $members->mapWithKeys(fn ($m) => [$m['id'] => $m['open_count'] + $m['waiting_count']])->all();
            $rows = [];
            foreach ($tpl->tasks() as $t) {
                $candidates = $members->where('role', $t['role'])->sortBy(fn ($m) => $load[$m['id']]);
                $pick = $t['role'] ? $candidates->first() : null;
                if ($pick) {
                    $load[$pick['id']]++; // spread the work inside the same template too
                }
                $row = [
                    'key' => $t['key'], 'name' => $t['name'], 'activity' => $t['activity'], 'role' => $t['role'],
                    'role_label' => $t['role'] ? Role::from($t['role'])->label() : null,
                    'after' => $t['after'], 'due_date' => self::dueDate($t, $project)->toDateString(),
                    'assigned_to' => $pick['id'] ?? null,
                ];
                if ($withMoney) {
                    $row['member_fee'] = $t['member_fee'];
                    $row['client_share'] = intdiv($project->total_amount * $t['client_pct'], 100);
                }
                $rows[] = $row;
            }

            return ['id' => $tpl->id, 'name' => $tpl->name, 'description' => $tpl->description, 'tasks' => $rows];
        })->all();
    }

    /** Part of the project price not yet given to tasks. */
    public static function shareLeft(Project $project): int
    {
        return max(0, $project->total_amount - (int) $project->tasks()->sum('client_share'));
    }

    /**
     * Create the activities and tasks of a template on a project.
     *
     * @param  array<int, array{key: string, include?: bool, assigned_to?: int|string|null, due_date?: string|null}>  $choices
     */
    public static function apply(Project $project, ProjectTemplate $tpl, array $choices, User $by, bool $skipShares = false): int
    {
        $choices = collect($choices)->keyBy('key');
        $tasks = collect($tpl->tasks())->filter(fn ($t) => (bool) ($choices[$t['key']]['include'] ?? true))->values();
        if ($tasks->isEmpty()) {
            throw ValidationException::withMessages(['rows' => 'Gardez au moins une tâche.']);
        }

        $errors = [];
        foreach ($tasks as $t) {
            $c = $choices[$t['key']] ?? [];
            $user = ! empty($c['assigned_to']) ? User::where('is_active', true)->find($c['assigned_to']) : null;
            if (! $user || $user->isSuperAdmin()) {
                $errors["rows.{$t['key']}.assigned_to"] = "Choisissez qui fait « {$t['name']} ».";
            }
            if (! empty($c['due_date']) && strtotime($c['due_date']) === false) {
                $errors["rows.{$t['key']}.due_date"] = 'Date invalide.';
            } elseif (! empty($c['due_date']) && ($c['due_date'] < $project->taskStartDate()->toDateString() || $c['due_date'] > $project->delivery_date->toDateString())) {
                $errors["rows.{$t['key']}.due_date"] = 'Choisissez une date comprise dans la durée du projet ('.$project->taskStartDate()->format('d/m/Y').' – '.$project->delivery_date->format('d/m/Y').').';
            }
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        $all = collect($tpl->tasks())->keyBy('key');
        $kept = $tasks->keyBy('key');

        $created = DB::transaction(function () use ($project, $tasks, $choices, $all, $kept, $by, $tpl, $skipShares) {
            $shares = $tasks->sum(fn ($t) => intdiv($project->total_amount * $t['client_pct'], 100));
            $existing = (int) $project->tasks()->sum('client_share');
            // The assistant does not handle money: shares that do not fit are simply left for the admin.
            $skipShares = $skipShares || (! $by->isAdmin() && $existing + $shares > $project->total_amount);
            if (! $skipShares && $existing + $shares > $project->total_amount) {
                throw ValidationException::withMessages(['rows' => 'Les parts client de ce modèle ('.Money::fcfa($shares).') dépassent ce qui reste du prix du projet ('.Money::fcfa($project->total_amount - $existing).').']);
            }

            $activities = [];
            $ids = [];
            $made = collect();
            foreach ($tasks as $t) {
                $name = $t['activity'];
                $activities[$name] ??= $project->activities()->whereRaw('lower(name) = ?', [Str::lower($name)])->first()
                    ?? $project->activities()->create(['name' => $name, 'created_by' => $by->id]);
                $c = $choices[$t['key']] ?? [];
                $assignee = User::find($c['assigned_to']);
                $task = Task::create([
                    'activity_id' => $activities[$name]->id,
                    'project_id' => $project->id,
                    'name' => $t['name'],
                    'instructions' => $t['instructions'],
                    'assigned_to' => $assignee->id,
                    'due_date' => ! empty($c['due_date']) ? $c['due_date'] : self::dueDate($t, $project)->toDateString(),
                    'member_fee' => $assignee->isAdmin() ? 0 : $t['member_fee'],
                    'client_share' => $skipShares ? 0 : intdiv($project->total_amount * $t['client_pct'], 100),
                    'status' => TaskStatus::Todo,
                    'created_by' => $by->id,
                ]);
                $ids[$t['key']] = $task->id;
                $made->push([$task, $t]);
            }

            // Link the steps. If the step to wait for was left out, wait for the one before it.
            foreach ($made as [$task, $t]) {
                $dep = $t['after'];
                for ($i = 0; $dep !== null && ! $kept->has($dep) && $i < 200; $i++) {
                    $dep = $all[$dep]['after'] ?? null;
                }
                if ($dep !== null && isset($ids[$dep])) {
                    $task->update(['depends_on_id' => $ids[$dep]]);
                }
            }

            ActivityLog::record('created', "Modèle « {$tpl->name} » appliqué au projet « {$project->name} » : {$made->count()} tâche(s) créée(s)", $project);

            return $made->map(fn ($m) => $m[0]);
        });

        foreach ($created as $task) {
            if ($task->assignee) {
                $task->load(['assignee', 'project', 'dependency']);
                $wait = $task->isWaiting() ? " Elle démarrera après « {$task->dependency->name} » : vous serez prévenu." : '';
                Notifier::sendNow($task->assignee, 'task_assigned', 'Nouvelle tâche assignée',
                    "« {$task->name} » ({$project->name}) — à livrer le {$task->due_date->format('d/m/Y')}.$wait", "/tasks/{$task->id}");
            }
        }

        return $created->count();
    }

    /** Build a template from what was done on a real project. */
    public static function fromProject(Project $project): array
    {
        $event = $project->event_date ? CarbonImmutable::parse($project->event_date) : null;
        $delivery = CarbonImmutable::parse($project->delivery_date);
        $activities = [];
        foreach ($project->activities()->with(['tasks' => fn ($q) => $q->with('assignee')->orderBy('due_date')])->orderBy('id')->get() as $a) {
            $tasks = [];
            foreach ($a->tasks as $t) {
                $due = CarbonImmutable::parse($t->due_date);
                $useEvent = $event && $due->gte($event) && $event->diffInDays($due) <= $due->diffInDays($delivery);
                $role = $t->assignee?->role;
                $tasks[] = [
                    'key' => 't'.$t->id,
                    'name' => $t->name,
                    'instructions' => $t->instructions,
                    'role' => $role && $role !== Role::Assistant ? $role->value : null,
                    'from' => $useEvent ? 'event' : 'delivery',
                    'days' => $useEvent ? (int) $event->diffInDays($due) : max(0, (int) $due->diffInDays($delivery, false)),
                    'member_fee' => $t->member_fee,
                    'client_pct' => $project->total_amount > 0 ? (int) round($t->client_share * 100 / $project->total_amount) : 0,
                    'after' => $t->depends_on_id ? 't'.$t->depends_on_id : null,
                ];
            }
            if ($tasks) {
                $activities[] = ['name' => $a->name, 'tasks' => $tasks];
            }
        }
        // Rounding can push the total just above 100 %.
        $sum = array_sum(array_map(fn ($a) => array_sum(array_column($a['tasks'], 'client_pct')), $activities));
        if ($sum > 100) {
            foreach ($activities as &$a) {
                foreach ($a['tasks'] as &$t) {
                    $t['client_pct'] = intdiv($t['client_pct'] * 100, $sum);
                }
            }
            unset($a, $t);
        }
        // Dependencies on archived tasks disappear.
        $keys = collect($activities)->flatMap(fn ($a) => array_column($a['tasks'], 'key'))->all();
        foreach ($activities as &$a) {
            foreach ($a['tasks'] as &$t) {
                if ($t['after'] && ! in_array($t['after'], $keys, true)) {
                    $t['after'] = null;
                }
            }
        }
        unset($a, $t);

        return ['activities' => $activities];
    }
}
