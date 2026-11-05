<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Models\Penalty;
use App\Models\PenaltyRefund;
use App\Models\PenaltySettlement;
use App\Models\StudioSetting;
use App\Models\User;
use App\Services\Money;
use App\Services\Notifier;
use App\Services\PenaltyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class PenaltyController extends Controller
{
    public function index(Request $request): Response
    {
        PenaltyService::accrueAll();
        $viewer = $request->user();
        $memberId = $request->integer('member') ?: null;

        $members = User::withTrashed()
            ->withSum('activePenalties as penalties_sum_amount', 'amount')
            ->withSum('penaltySettlements', 'amount')
            ->withSum('penaltyRefunds', 'amount')
            ->withCount('penalties')
            ->withCount('activePenalties')
            ->get()
            ->filter(fn ($u) => $u->penalties_count > 0)
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'role_label' => $u->role->label(),
                'accrued' => (int) $u->penalties_sum_amount,
                'settled' => (int) $u->penalty_settlements_sum_amount,
                'refunded' => (int) $u->penalty_refunds_sum_amount,
                'debt' => (int) $u->penalties_sum_amount - (int) $u->penalty_settlements_sum_amount + (int) $u->penalty_refunds_sum_amount,
                'count' => $u->active_penalties_count,
            ])->sortByDesc('debt')->values();

        $penalties = Penalty::query()->with(['task.project', 'user'])
            ->when($memberId, fn ($q) => $q->where('user_id', $memberId))
            ->latest('accrued_at')->limit(300)->get()
            ->groupBy('task_id')
            ->map(function ($rows) {
                $active = $rows->whereNull('cancelled_at');

                return [
                    'task' => ['id' => $rows->first()->task->id, 'name' => $rows->first()->task->name, 'project' => $rows->first()->task->project?->name, 'due_date' => $rows->first()->task->due_date->toDateString(), 'status_label' => $rows->first()->task->status->label()],
                    'member' => $rows->first()->user->name,
                    'member_id' => $rows->first()->user_id,
                    'count' => $active->count(),
                    'total' => (int) $active->sum('amount'),
                    'cancelled_count' => $rows->count() - $active->count(),
                    'cancelled_total' => (int) $rows->sum('amount') - (int) $active->sum('amount'),
                    'active_ids' => $active->pluck('id')->values(),
                    'last_at' => $rows->max('accrued_at')->toIso8601String(),
                ];
            })->values();

        $cancellations = Penalty::query()->with(['task', 'user', 'canceller'])->whereNotNull('cancelled_at')
            ->when($memberId, fn ($q) => $q->where('user_id', $memberId))
            ->latest('cancelled_at')->limit(300)->get()
            ->groupBy(fn ($p) => $p->cancel_batch ?? 'p'.$p->id)
            ->map(fn ($rows) => [
                'key' => $rows->first()->id,
                'member' => $rows->first()->user->name,
                'task' => ['id' => $rows->first()->task_id, 'name' => $rows->first()->task?->name],
                'count' => $rows->count(),
                'amount' => (int) $rows->sum('amount'),
                'reason' => $rows->first()->cancel_reason,
                'cancelled_by' => $rows->first()->canceller?->name,
                'cancelled_at' => $rows->first()->cancelled_at->toIso8601String(),
            ])->values();

        $settlements = PenaltySettlement::query()->with(['user', 'collector', 'memberPayment'])
            ->when($memberId, fn ($q) => $q->where('user_id', $memberId))
            ->latest('settled_at')->limit(300)->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'member' => $s->user->name,
                'type' => $s->type,
                'type_label' => $s->type === 'withheld' ? 'Retenue sur versement' : 'Paiement direct',
                'amount' => $s->amount,
                'method_label' => $s->method ? PaymentMethod::from($s->method)->label() : null,
                'receipt' => $s->memberPayment?->receipt_number,
                'note' => $s->note,
                'collected_by' => $s->collector?->name,
                'settled_at' => $s->settled_at->toIso8601String(),
            ]);

        $settings = StudioSetting::current();

        return Inertia::render('penalties/index', [
            'members' => $members,
            'penalties' => $penalties,
            'settlements' => $settlements,
            'cancellations' => $cancellations,
            'refunds' => PenaltyRefund::with(['user', 'task', 'refunder'])->when($memberId, fn ($q) => $q->where('user_id', $memberId))->latest('refunded_at')->limit(300)->get()->map(fn ($r) => $r->toRow()),
            'canCancel' => $viewer->isAdmin(),
            'filters' => ['member' => $memberId],
            'methods' => PaymentMethod::options(),
            'config' => ['enabled' => $settings->penalties_enabled, 'amount' => $settings->penalty_amount, 'interval' => $settings->penalty_interval_days],
            'canCollect' => $viewer->isStaff(),
        ]);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'penalty_ids' => ['required', 'array', 'min:1'],
            'penalty_ids.*' => ['integer', 'exists:penalties,id'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
            'refund_method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'refund_reference' => ['nullable', 'string', 'max:255'],
        ], ['reason.required' => 'Le motif de l\'annulation est obligatoire.', 'reason.min' => 'Précisez le motif de l\'annulation.']);

        $result = PenaltyService::cancel($data['penalty_ids'], $data['reason'], $request->user(), [
            'method' => $data['refund_method'] ?? null,
            'reference' => $data['refund_reference'] ?? null,
        ]);

        $message = count($result['penalties']).' pénalité(s) annulée(s) ('.Money::fcfa((int) $result['penalties']->sum('amount')).')';
        foreach ($result['refunds'] as $r) {
            $message .= ' — remboursement '.Money::fcfa($r->amount)." enregistré, reçu {$r->receipt_number}";
        }

        return back()->with('success', $message.'.');
    }

    public function collect(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['nullable', Rule::enum(PaymentMethod::class)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $member = User::withTrashed()->findOrFail($data['user_id']);

        try {
            $settlement = PenaltyService::collectDirect($member, (int) $data['amount'], $data['method'] ?? null, $data['note'] ?? null, $request->user());
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['amount' => $e->getMessage()]);
        }

        Notifier::admins('penalty_collected', 'Pénalité encaissée',
            "{$request->user()->name} a encaissé ".Money::fcfa($settlement->amount)." de pénalité auprès de {$member->name}.", '/penalties', $request->user());
        Notifier::send($member, 'penalty_collected', 'Paiement de pénalité enregistré',
            'Votre paiement de '.Money::fcfa($settlement->amount).' a été enregistré. Reste dû : '.Money::fcfa($member->penaltyDebt()).'.', '/me/earnings');

        return back()->with('success', 'Paiement de pénalité enregistré.');
    }
}
