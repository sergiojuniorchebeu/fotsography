<?php

namespace App\Services;

use App\Enums\ProjectStatus;
use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Models\ClientPayment;
use App\Models\Expense;
use App\Models\MemberPayment;
use App\Models\PenaltyRefund;
use App\Models\PenaltySettlement;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Studio-wide money figures. Margin = collected − expenses − remunerations actually paid (net).
 */
class FinanceService
{
    /** @return array<string, int> */
    public static function summary(): array
    {
        $projects = Project::query()->where('status', '!=', ProjectStatus::Cancelled)->withSum('payments', 'amount')->get();
        $collected = (int) ClientPayment::sum('amount');
        $expenses = (int) Expense::sum('amount');
        $fees = (int) MemberPayment::sum('net_amount');
        $feesDue = max(0, (int) Task::where('status', TaskStatus::Done)->sum('member_fee') - (int) MemberPayment::sum('gross_amount'));
        $refunds = (int) PenaltyRefund::sum('amount');

        return [
            'revenue' => (int) $projects->sum('total_amount'),
            'collected' => $collected,
            'remaining' => (int) $projects->sum(fn ($p) => max(0, $p->total_amount - (int) $p->payments_sum_amount)),
            'expenses' => $expenses,
            'fees_paid' => $fees,
            'fees_due' => $feesDue,
            'withheld' => (int) MemberPayment::sum('penalty_deducted'),
            'penalties_collected' => (int) PenaltySettlement::sum('amount') - $refunds,
            'penalty_refunds' => $refunds,
            'margin' => $collected - $expenses - $fees - $refunds,
        ];
    }

    /** @return Collection<int, array<string, mixed>> */
    public static function projects(): Collection
    {
        return Project::query()->with('client')
            ->withSum('payments', 'amount')
            ->withSum('expenses', 'amount')
            ->withSum('memberPayments', 'net_amount')
            ->withSum('memberPayments as member_payments_sum_gross_amount', 'gross_amount')
            ->withSum('tasks', 'member_fee')
            ->withSum(['tasks as tasks_validated_fee_sum' => fn ($q) => $q->where('status', TaskStatus::Done)], 'member_fee')
            ->withSum('penaltyRefunds', 'amount')
            ->orderByDesc('delivery_date')->get()
            ->map(function (Project $p) {
                $collected = (int) $p->payments_sum_amount;
                $expenses = (int) $p->expenses_sum_amount;
                $fees = (int) $p->member_payments_sum_net_amount;
                $feesDue = max(0, (int) $p->tasks_validated_fee_sum - (int) $p->member_payments_sum_gross_amount);
                $refunds = (int) $p->penalty_refunds_sum_amount;

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'client' => $p->client?->name,
                    'status' => $p->status->value,
                    'status_label' => $p->status->label(),
                    'delivery_date' => $p->delivery_date->toDateString(),
                    'revenue' => $p->total_amount,
                    'collected' => $collected,
                    'remaining' => $p->status === ProjectStatus::Cancelled ? 0 : max(0, $p->total_amount - $collected),
                    'expenses' => $expenses,
                    'fees_planned' => (int) $p->tasks_sum_member_fee,
                    'fees_paid' => $fees,
                    'fees_due' => $feesDue,
                    'refunds' => $refunds,
                    'margin' => $collected - $expenses - $fees - $refunds,
                ];
            });
    }

    /** @return array<int, array<string, mixed>> */
    public static function monthly(int $months = 12): array
    {
        $start = CarbonImmutable::today()->startOfMonth()->subMonths($months - 1);
        $bucket = fn ($rows, string $dateField, string $amountField) => collect($rows)
            ->groupBy(fn ($r) => CarbonImmutable::parse($r->{$dateField})->format('Y-m'))
            ->map(fn ($g) => (int) $g->sum($amountField));

        $collected = $bucket(ClientPayment::where('paid_at', '>=', $start)->get(['paid_at', 'amount']), 'paid_at', 'amount');
        $expenses = $bucket(Expense::where('spent_at', '>=', $start)->get(['spent_at', 'amount']), 'spent_at', 'amount');
        $fees = $bucket(MemberPayment::where('paid_at', '>=', $start)->get(['paid_at', 'net_amount']), 'paid_at', 'net_amount');
        $refunds = $bucket(PenaltyRefund::where('refunded_at', '>=', $start)->get(['refunded_at', 'amount']), 'refunded_at', 'amount');

        $out = [];
        for ($i = 0; $i < $months; $i++) {
            $m = $start->addMonths($i);
            $key = $m->format('Y-m');
            $c = $collected[$key] ?? 0;
            $e = $expenses[$key] ?? 0;
            // Money paid out to members: net remunerations + penalty refunds.
            $f = ($fees[$key] ?? 0) + ($refunds[$key] ?? 0);
            $out[] = ['month' => $key, 'label' => ucfirst($m->locale('fr')->isoFormat('MMM YY')), 'collected' => $c, 'expenses' => $e, 'fees' => $f, 'margin' => $c - $e - $f];
        }

        return $out;
    }

    /** @return Collection<int, array<string, mixed>> */
    public static function members(): Collection
    {

        return User::query()
            ->where('role', '!=', Role::SuperAdmin)
            ->withCount([
                'tasks',
                'tasks as tasks_done_count' => fn ($q) => $q->where('status', 'done'),
                'tasks as tasks_late_count' => fn ($q) => $q->late(),
                'tasks as tasks_penalized_count' => fn ($q) => $q->where('penalty_periods', '>', 0),
            ])
            ->withSum('tasks', 'member_fee')
            ->withSum(['tasks as tasks_validated_fee_sum' => fn ($q) => $q->where('status', TaskStatus::Done)], 'member_fee')
            ->withSum('memberPayments', 'gross_amount')
            ->withSum('memberPayments', 'net_amount')
            ->withSum('activePenalties as penalties_sum_amount', 'amount')
            ->withSum('penaltySettlements', 'amount')
            ->withSum('penaltyRefunds', 'amount')
            ->orderBy('name')->get()
            ->filter(fn (User $u) => ! $u->isAdmin() || $u->tasks_count > 0)
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role_label' => $u->role->label(),
                'is_active' => $u->is_active,
                'tasks' => $u->tasks_count,
                'done' => $u->tasks_done_count,
                'late' => $u->tasks_late_count,
                'penalized' => $u->tasks_penalized_count,
                'fees_total' => (int) $u->tasks_sum_member_fee,
                'gross_paid' => (int) $u->member_payments_sum_gross_amount,
                'net_paid' => (int) $u->member_payments_sum_net_amount,
                'remaining' => max(0, (int) $u->tasks_validated_fee_sum - (int) $u->member_payments_sum_gross_amount),
                'penalties' => (int) $u->penalties_sum_amount,
                'penalty_debt' => (int) $u->penalties_sum_amount - (int) $u->penalty_settlements_sum_amount + (int) $u->penalty_refunds_sum_amount,
            ])->values();
    }
}
