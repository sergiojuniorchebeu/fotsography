<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Penalty;
use App\Models\PenaltyRefund;
use App\Models\PenaltySettlement;
use App\Models\Sequence;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Late-delivery penalties.
 *
 * A task "clock" is described by: penalty_base (periods already counted when the
 * clock was last re-anchored), penalty_anchor (date the clock starts from,
 * null = the task due date) and penalty_immediate (whether the first late day
 * triggers a penalty straight away). Counted penalties are rows in `penalties`
 * and are never deleted, so a debt never decreases except through settlements.
 */
class PenaltyService
{
    public static function targetPeriods(Task $task, CarbonImmutable $today, int $interval): int
    {
        $anchor = $task->penalty_anchor ?? $task->due_date;
        $days = (int) $anchor->startOfDay()->diffInDays($today->startOfDay(), false);
        if ($days < 1) {
            return $task->penalty_base;
        }
        $interval = max(1, $interval);
        $extra = $task->penalty_immediate ? 1 + intdiv($days - 1, $interval) : intdiv($days, $interval);

        return $task->penalty_base + $extra;
    }

    public static function daysLate(Task $task, ?CarbonImmutable $today = null): int
    {
        $today ??= CarbonImmutable::today();

        return max(0, (int) $task->due_date->diffInDays($today, false));
    }

    /** Accrue missing penalties for one task. Returns the number of new penalties. */
    public static function accrue(Task $task, ?CarbonImmutable $today = null): int
    {
        $settings = StudioSetting::current();
        $today ??= CarbonImmutable::today();

        if (! $settings->penalties_enabled || ! $task->status->isOpen() || ! $task->assigned_to || $task->isWaiting()) {
            return 0;
        }
        $task->loadMissing('assignee');
        if (! $task->assignee || $task->assignee->isAdmin()) {
            return 0;
        }

        $target = self::targetPeriods($task, $today, $settings->penalty_interval_days);
        if ($target <= $task->penalty_periods) {
            return 0;
        }

        $created = 0;
        DB::transaction(function () use ($task, $target, $settings, $today, &$created) {
            for ($p = $task->penalty_periods + 1; $p <= $target; $p++) {
                Penalty::create([
                    'task_id' => $task->id,
                    'user_id' => $task->assigned_to,
                    'period' => $p,
                    'amount' => $settings->penalty_amount,
                    'days_late' => self::daysLate($task, $today),
                    'accrued_at' => now(),
                ]);
                $created++;
            }
            $task->forceFill(['penalty_periods' => $target])->saveQuietly();
        });

        if ($created > 0) {
            $total = $created * $settings->penalty_amount;
            Notifier::send($task->assignee, 'penalty', 'Nouvelle pénalité de retard',
                "« {$task->name} » est en retard : ".Money::fcfa($total).' de pénalité.', "/tasks/{$task->id}");
        }

        return $created;
    }

    public static function accrueAll(): int
    {
        if (! StudioSetting::current()->penalties_enabled) {
            return 0;
        }
        $count = 0;
        Task::query()->with('assignee')->late()
            ->whereNotNull('assigned_to')
            ->each(function (Task $task) use (&$count) {
                $count += self::accrue($task);
            });

        return $count;
    }

    /** Freeze what has been counted and restart the clock (task returned, due date moved). */
    public static function reanchor(Task $task, bool $fromToday): void
    {
        $today = CarbonImmutable::today();
        $late = $fromToday && $task->due_date->lt($today);
        $task->forceFill([
            'penalty_base' => $task->penalty_periods,
            'penalty_anchor' => $late ? $today : null,
            'penalty_immediate' => ! $late,
        ]);
    }

    /** When the module is (re)enabled, the disabled period must not be charged retroactively. */
    public static function reanchorAllLate(): void
    {
        Task::query()->late()
            ->each(function (Task $task) {
                self::reanchor($task, true);
                $task->saveQuietly();
            });
    }

    /**
     * Admin cancels penalties with a reason. The rows stay in the history (never deleted)
     * but no longer count in the member's debt. The penalty clock is untouched, so a
     * cancelled period is never counted again.
     *
     * If part of the cancelled amount was already settled (withheld on a payment or paid
     * directly), the studio owes it back: a refund is recorded (method required) with its
     * own receipt, so the member's debt never becomes negative.
     *
     * @param  array<int, int>  $ids
     * @param  array{method?: string|null, reference?: string|null}  $refund
     * @return array{penalties: Collection<int, Penalty>, refunds: Collection<int, PenaltyRefund>}
     */
    public static function cancel(array $ids, string $reason, User $admin, array $refund = []): array
    {
        $result = DB::transaction(function () use ($ids, $reason, $admin, $refund) {
            $penalties = Penalty::query()->with(['user', 'task'])->whereIn('id', $ids)->whereNull('cancelled_at')->lockForUpdate()->get();
            if ($penalties->isEmpty()) {
                throw ValidationException::withMessages(['penalty_ids' => 'Aucune pénalité active à annuler.']);
            }

            // Work out, per member, how much was already settled and must be refunded.
            $toRefund = [];
            foreach ($penalties->groupBy('user_id') as $userId => $rows) {
                $member = $rows->first()->user;
                $excess = (int) $rows->sum('amount') - max(0, $member->penaltyDebt());
                if ($excess > 0) {
                    if (empty($refund['method'])) {
                        throw ValidationException::withMessages(['refund_method' => Money::fcfa($excess)." de ces pénalités ont déjà été réglés par {$member->name} : indiquez comment ils lui sont remboursés."]);
                    }
                    $toRefund[$userId] = $excess;
                }
            }

            $batch = (string) Str::uuid();
            foreach ($penalties as $penalty) {
                $penalty->update(['cancelled_at' => now(), 'cancelled_by' => $admin->id, 'cancel_reason' => $reason, 'cancel_batch' => $batch]);
            }

            foreach ($penalties->groupBy('task_id') as $rows) {
                $task = $rows->first()->task;
                ActivityLog::record('updated', count($rows).' pénalité(s) annulée(s) ('.Money::fcfa((int) $rows->sum('amount')).") sur « {$task?->name} » pour {$rows->first()->user->name}", $task, ['motif' => $reason, 'pénalités' => $rows->pluck('id')->all()]);
            }

            $refunds = collect();
            foreach ($toRefund as $userId => $amount) {
                $rows = $penalties->where('user_id', $userId);
                $taskIds = $rows->pluck('task_id')->unique();
                $task = $taskIds->count() === 1 ? $rows->first()->task : null;
                $r = PenaltyRefund::create([
                    'user_id' => $userId,
                    'task_id' => $task?->id,
                    'project_id' => $task?->project_id,
                    'amount' => $amount,
                    'method' => $refund['method'],
                    'reference' => $refund['reference'] ?? null,
                    'reason' => $reason,
                    'receipt_number' => Sequence::nextNumber('penalty_refund', 'RB'),
                    'refunded_by' => $admin->id,
                    'refunded_at' => now(),
                ]);
                ActivityLog::record('payment', "Remboursement {$r->receipt_number} de ".Money::fcfa($amount)." à {$rows->first()->user->name} (pénalités annulées déjà réglées)", $r, ['motif' => $reason]);
                $refunds->push($r);
            }

            return ['penalties' => $penalties, 'refunds' => $refunds];
        });

        foreach ($result['penalties']->groupBy('user_id') as $userId => $rows) {
            $member = $rows->first()->user;
            $refunded = (int) $result['refunds']->where('user_id', $userId)->sum('amount');
            Notifier::send($member, 'penalty_cancelled', 'Pénalité annulée',
                Money::fcfa((int) $rows->sum('amount'))." de pénalité annulé(s) par {$admin->name}".($refunded ? ', dont '.Money::fcfa($refunded).' vous sont remboursés' : '').". Motif : {$reason}", '/me/earnings');
        }

        return $result;
    }

    public static function collectDirect(User $member, int $amount, ?string $method, ?string $note, User $collector): PenaltySettlement
    {
        return DB::transaction(function () use ($member, $amount, $method, $note, $collector) {
            User::whereKey($member->id)->lockForUpdate()->first();
            $debt = $member->penaltyDebt();
            if ($amount < 1 || $amount > $debt) {
                throw new InvalidArgumentException('Le montant dépasse ce que le membre doit ('.Money::fcfa($debt).').');
            }
            $settlement = PenaltySettlement::create([
                'user_id' => $member->id,
                'type' => 'direct',
                'amount' => $amount,
                'method' => $method,
                'note' => $note,
                'collected_by' => $collector->id,
                'settled_at' => now(),
            ]);
            ActivityLog::record('payment', "Pénalité encaissée auprès de {$member->name} : ".Money::fcfa($amount), $settlement);

            return $settlement;
        });
    }
}
