<?php

namespace App\Services;

use App\Enums\ClientPaymentType;
use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\ActivityLog;
use App\Models\ClientPayment;
use App\Models\Invoice;
use App\Models\MemberPayment;
use App\Models\PenaltySettlement;
use App\Models\Project;
use App\Models\Sequence;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    /** @param array{type: string, amount?: int|null, method: string, reference?: string|null, note?: string|null, paid_at?: string|null} $data */
    public static function recordClientPayment(Project $project, array $data, User $by): ClientPayment
    {
        $payment = DB::transaction(function () use ($project, $data, $by) {
            $project = Project::whereKey($project->id)->lockForUpdate()->firstOrFail();

            if ($project->status === ProjectStatus::Cancelled) {
                throw ValidationException::withMessages(['amount' => 'Impossible d\'encaisser un paiement sur un projet annulé.']);
            }

            $type = ClientPaymentType::from($data['type']);
            $remaining = $project->remainingAmount();

            if ($type === ClientPaymentType::Free) {
                $amount = (int) ($data['amount'] ?? 0);
            } else {
                if ($project->payments()->where('type', $type->value)->exists()) {
                    throw ValidationException::withMessages(['type' => "La tranche « {$type->label()} » a déjà été encaissée."]);
                }
                $amount = (int) ($data['amount'] ?? 0) ?: $project->plan()[$type->value];
            }

            if ($amount < 1) {
                throw ValidationException::withMessages(['amount' => 'Le montant doit être supérieur à zéro.']);
            }
            if ($amount > $remaining) {
                throw ValidationException::withMessages(['amount' => 'Le montant dépasse le reste à payer ('.Money::fcfa($remaining).').']);
            }

            $payment = ClientPayment::create([
                'project_id' => $project->id,
                'client_id' => $project->client_id,
                'type' => $type,
                'amount' => $amount,
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'receipt_number' => Sequence::nextNumber('client_receipt'),
                'paid_at' => $data['paid_at'] ?? now(),
                'recorded_by' => $by->id,
            ]);

            ActivityLog::record('payment', "Encaissement {$payment->receipt_number} ({$type->label()}) de ".Money::fcfa($amount)." sur « {$project->name} »", $payment);

            if ($project->remainingAmount() === 0 && ! $project->invoice()->exists()) {
                $invoice = Invoice::create([
                    'project_id' => $project->id,
                    'number' => Sequence::nextNumber('invoice', 'F'),
                    'amount' => $project->total_amount,
                    'issued_at' => now(),
                    'issued_by' => $by->id,
                ]);
                ActivityLog::record('created', "Facture finale {$invoice->number} générée pour « {$project->name} »", $invoice);
            }

            return $payment;
        });

        Notifier::admins('client_payment', 'Paiement client reçu',
            "{$project->client->name} a payé ".Money::fcfa($payment->amount)." pour « {$project->name} ».", "/projects/{$project->id}", $by);

        return $payment;
    }

    /** @param array{amount: int, method: string, reference?: string|null, note?: string|null} $data */
    public static function payMember(Task $task, array $data, User $by): MemberPayment
    {
        $payment = DB::transaction(function () use ($task, $data, $by) {
            $task = Task::whereKey($task->id)->lockForUpdate()->firstOrFail();
            $member = $task->assignee;

            if ($task->status !== TaskStatus::Done) {
                throw ValidationException::withMessages(['amount' => 'La rémunération devient payable après la validation de la tâche.']);
            }
            if (! $member || $member->isAdmin()) {
                throw ValidationException::withMessages(['amount' => 'Cette tâche n\'a pas de rémunération à verser.']);
            }

            $gross = (int) $data['amount'];
            $remaining = $task->remainingFee();
            if ($gross < 1) {
                throw ValidationException::withMessages(['amount' => 'Le montant doit être supérieur à zéro.']);
            }
            if ($gross > $remaining) {
                throw ValidationException::withMessages(['amount' => 'Le montant dépasse le reste dû ('.Money::fcfa($remaining).').']);
            }

            PenaltyService::accrue($task);
            $withheld = min($gross, max(0, $member->penaltyDebt()));

            $payment = MemberPayment::create([
                'task_id' => $task->id,
                'project_id' => $task->project_id,
                'user_id' => $member->id,
                'gross_amount' => $gross,
                'penalty_deducted' => $withheld,
                'net_amount' => $gross - $withheld,
                'method' => $data['method'],
                'reference' => $data['reference'] ?? null,
                'note' => $data['note'] ?? null,
                'receipt_number' => Sequence::nextNumber('member_receipt', 'R'),
                'paid_at' => now(),
                'paid_by' => $by->id,
            ]);

            if ($withheld > 0) {
                PenaltySettlement::create([
                    'user_id' => $member->id,
                    'type' => 'withheld',
                    'amount' => $withheld,
                    'member_payment_id' => $payment->id,
                    'collected_by' => $by->id,
                    'settled_at' => now(),
                    'note' => "Retenue sur le versement {$payment->receipt_number}",
                ]);
            }

            ActivityLog::record('payment', "Versement {$payment->receipt_number} à {$member->name} pour « {$task->name} » : brut ".Money::fcfa($gross).', retenue '.Money::fcfa($withheld).', net '.Money::fcfa($gross - $withheld), $payment);

            return $payment;
        });

        Notifier::send($payment->user, 'member_payment', 'Paiement reçu',
            'Vous avez reçu '.Money::fcfa($payment->net_amount)." pour « {$task->name} »".($payment->penalty_deducted ? ' (pénalité retenue : '.Money::fcfa($payment->penalty_deducted).')' : '').'.',
            "/tasks/{$task->id}");

        return $payment;
    }
}
