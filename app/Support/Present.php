<?php

namespace App\Support;

use App\Enums\TaskStatus;
use App\Enums\Role;
use App\Models\ClientPayment;
use App\Models\MemberPayment;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\PenaltyService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Serializes models for the UI, stripping financial data the viewer may not see.
 * - Admin: everything.
 * - Assistant: no money at all (penalties excepted, handled separately).
 * - Member: only their own remuneration.
 */
class Present
{
    /** @return array<string, mixed> */
    public static function project(Project $p, User $viewer, bool $withStats = false): array
    {
        $data = [
            'id' => $p->id,
            'name' => $p->name,
            'location' => $p->location,
            'event_date' => $p->event_date?->toDateString(),
            'start_date' => $p->taskStartDate()->toDateString(),
            'delivery_date' => $p->delivery_date->toDateString(),
            'status' => $p->status->value,
            'status_label' => $p->status->label(),
            'notes' => $p->notes,
            'client' => $p->relationLoaded('client') && $p->client ? ['id' => $p->client->id, 'name' => $p->client->name] : null,
        ];

        if ($withStats) {
            $data['tasks_total'] = $p->tasks_count ?? $p->tasks()->count();
            $data['tasks_done'] = $p->tasks_done_count ?? $p->tasks()->where('status', 'done')->count();
        }

        if ($viewer->isAdmin()) {
            $data['total_amount'] = $p->total_amount;
            $data['advance_pct'] = $p->advance_pct;
            $data['intermediate_pct'] = $p->intermediate_pct;
            $data['balance_pct'] = $p->balance_pct;
        }

        return $data;
    }

    /** @return array<string, mixed> */
    public static function task(Task $t, User $viewer, bool $full = false): array
    {
        $today = CarbonImmutable::today();
        $data = [
            'id' => $t->id,
            'name' => $t->name,
            'status' => $t->status->value,
            'status_label' => $t->status->label(),
            'due_date' => $t->due_date->toDateString(),
            'is_late' => $t->isLate(),
            'days_late' => $t->isLate() ? PenaltyService::daysLate($t, $today) : 0,
            'days_left' => (int) $today->diffInDays($t->due_date, false),
            'submitted_at' => $t->submitted_at?->toIso8601String(),
            'validated_at' => $t->validated_at?->toIso8601String(),
            'proof_url' => $t->proof_url,
            'proof_note' => $t->proof_note,
            'assignee' => $t->assignee && (! $t->assignee->isSuperAdmin() || $viewer->isSuperAdmin()) ? ['id' => $t->assignee->id, 'name' => $t->assignee->name, 'role_label' => $t->assignee->role->label()] : null,
            'activity' => $t->relationLoaded('activity') && $t->activity ? ['id' => $t->activity->id, 'name' => $t->activity->name] : null,
            'project' => $t->relationLoaded('project') && $t->project ? ['id' => $t->project->id, 'name' => $t->project->name] : null,
            'penalty_periods' => $t->penalty_periods,
            'instructions' => $t->instructions,
            'started_at' => $t->started_at?->toIso8601String(),
            'depends_on_id' => $t->depends_on_id,
            'is_waiting' => $t->isWaiting(),
            'dependency' => $t->depends_on_id && $t->dependency ? [
                'id' => $t->dependency->id,
                'name' => $t->dependency->name,
                'status' => $t->dependency->status->value,
                'status_label' => $t->dependency->status->label(),
                'assignee' => $t->dependency->assignee?->nameFor($viewer),
                'due_date' => $t->dependency->due_date->toDateString(),
                // Files handed over by the previous step (only once validated).
                'delivery_url' => $full && $t->dependency->status === TaskStatus::Done ? $t->dependency->proof_url : null,
                'delivery_note' => $full && $t->dependency->status === TaskStatus::Done ? $t->dependency->proof_note : null,
            ] : null,
        ];

        if ($full) {
            $data['dependents'] = $t->dependents()->with('assignee')->get()->map(fn (Task $d) => [
                'id' => $d->id, 'name' => $d->name, 'assignee' => $d->assignee?->nameFor($viewer), 'status' => $d->status->value, 'status_label' => $d->status->label(),
            ]);
            $data['reviews'] = $t->reviews()->with('user')->get()->map(fn ($r) => [
                'id' => $r->id,
                'action' => $r->action,
                'comment' => $r->comment,
                'corrections' => $r->corrections,
                'proof_url' => $r->proof_url,
                'user' => $r->user?->nameFor($viewer),
                'created_at' => $r->created_at?->toIso8601String(),
            ]);
        }

        $isOwner = $t->assigned_to === $viewer->id;
        if ($viewer->isAdmin() || $isOwner) {
            $data['member_fee'] = $t->member_fee;
            if ($full) {
                $data['paid_gross'] = $t->paidGross();
                $data['remaining_fee'] = $t->remainingFee();
                $data['payments'] = $t->payments()->with('payer')->latest('id')->get()->map(fn ($p) => self::memberPayment($p, $viewer));
                $data['penalties'] = $t->penalties()->with('canceller')->orderBy('period')->get()->map(fn ($p) => $p->toRow($viewer));
            }
        } elseif ($viewer->isAssistant() && $full) {
            // Assistants manage penalties, so they may see the penalty rows (no remuneration).
            $data['penalties'] = $t->penalties()->with('canceller')->orderBy('period')->get()->map(fn ($p) => $p->toRow($viewer));
        }

        if ($viewer->isAdmin()) {
            $data['client_share'] = $t->client_share;
        }

        return $data;
    }

    /**
     * Active people who can receive a task, with their current workload so the
     * admin can spread the work (shown in the assignment list and the team strip).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public static function assignable(): Collection
    {
        return User::query()->where('is_active', true)->where('role', '!=', Role::SuperAdmin)
            ->withCount([
                'tasks as open_count' => fn ($q) => $q->actionable(),
                'tasks as waiting_count' => fn ($q) => $q->waiting(),
                'tasks as review_count' => fn ($q) => $q->where('status', TaskStatus::Review->value),
                'tasks as late_count' => fn ($q) => $q->late(),
            ])
            ->orderBy('name')->get()
            ->map(fn (User $u) => [
                'id' => $u->id, 'name' => $u->name, 'role' => $u->role->value, 'role_label' => $u->role->label(),
                'open_count' => (int) $u->open_count, 'waiting_count' => (int) $u->waiting_count,
                'review_count' => (int) $u->review_count, 'late_count' => (int) $u->late_count,
            ]);
    }

    /** @return array<string, mixed> */
    public static function memberPayment(MemberPayment $p, ?User $viewer = null): array
    {
        return [
            'id' => $p->id,
            'receipt_number' => $p->receipt_number,
            'gross_amount' => $p->gross_amount,
            'penalty_deducted' => $p->penalty_deducted,
            'net_amount' => $p->net_amount,
            'method' => $p->method->value,
            'method_label' => $p->method->label(),
            'reference' => $p->reference,
            'note' => $p->note,
            'paid_at' => $p->paid_at->toIso8601String(),
            'paid_by' => $p->payer?->nameFor($viewer),
            'member' => $p->relationLoaded('user') ? $p->user?->nameFor($viewer) : null,
            'task' => $p->relationLoaded('task') && $p->task ? ['id' => $p->task->id, 'name' => $p->task->name] : null,
        ];
    }

    /** @return array<string, mixed> */
    public static function clientPayment(ClientPayment $p, ?User $viewer = null): array
    {
        return [
            'id' => $p->id,
            'receipt_number' => $p->receipt_number,
            'type' => $p->type->value,
            'type_label' => $p->type->label(),
            'amount' => $p->amount,
            'method' => $p->method->value,
            'method_label' => $p->method->label(),
            'reference' => $p->reference,
            'note' => $p->note,
            'paid_at' => $p->paid_at->toIso8601String(),
            'recorded_by' => $p->recorder?->nameFor($viewer),
            'project' => $p->relationLoaded('project') && $p->project ? ['id' => $p->project->id, 'name' => $p->project->name] : null,
        ];
    }
}
