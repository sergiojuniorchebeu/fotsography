<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Enums\TaskStatus;
use App\Services\PenaltyService;
use App\Support\Present;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EarningsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        Task::where('assigned_to', $user->id)->open()->each(fn ($t) => PenaltyService::accrue($t));

        $tasks = $user->tasks()->with('project')->get();
        $payments = $user->memberPayments()->with(['task', 'payer'])->latest('paid_at')->get();

        return Inertia::render('earnings/index', [
            'summary' => [
                'fees_total' => (int) $tasks->sum('member_fee'),
                'gross_paid' => (int) $payments->sum('gross_amount'),
                'net_paid' => (int) $payments->sum('net_amount'),
                'withheld' => (int) $payments->sum('penalty_deducted'),
                'remaining' => (int) $tasks->where('status', TaskStatus::Done)->sum(fn ($t) => $t->remainingFee()),
                'penalties_total' => (int) $user->activePenalties()->sum('amount'),
                'penalty_debt' => $user->penaltyDebt(),
                'refunded' => (int) $user->penaltyRefunds()->sum('amount'),
            ],
            'payments' => $payments->map(fn ($p) => Present::memberPayment($p, $user)),
            'penalties' => $user->penalties()->with(['task', 'canceller'])->latest('accrued_at')->get()->map(fn ($p) => [
                ...$p->toRow($user), 'task' => $p->task?->name, 'task_id' => $p->task_id,
            ]),
            'settlements' => $user->penaltySettlements()->with('collector')->latest('settled_at')->get()->map(fn ($s) => [
                'id' => $s->id, 'type_label' => $s->type === 'withheld' ? 'Retenue sur versement' : 'Paiement direct',
                'amount' => $s->amount, 'note' => $s->note, 'collected_by' => $s->collector?->nameFor($user), 'settled_at' => $s->settled_at->toIso8601String(),
            ]),
            'refunds' => $user->penaltyRefunds()->with(['task', 'refunder'])->latest('refunded_at')->get()->map(fn ($r) => $r->toRow($user)),
        ]);
    }
}
