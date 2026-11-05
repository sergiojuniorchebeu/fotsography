<?php

namespace App\Http\Controllers;

use App\Models\ClientPayment;
use App\Models\Expense;
use App\Models\MemberPayment;
use App\Models\Penalty;
use App\Models\PenaltyRefund;
use App\Models\PenaltySettlement;
use App\Services\FinanceService;
use App\Support\Present;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('finances/index', [
            'summary' => FinanceService::summary(),
            'projects' => FinanceService::projects(),
            'monthly' => FinanceService::monthly(),
            'members' => FinanceService::members(),
            'recentPayments' => ClientPayment::with(['project', 'recorder'])->latest('paid_at')->limit(10)->get()->map(fn ($p) => Present::clientPayment($p)),
            'recentMemberPayments' => MemberPayment::with(['user', 'task', 'payer'])->latest('paid_at')->limit(10)->get()->map(fn ($p) => Present::memberPayment($p)),
        ]);
    }

    public function export(string $type): StreamedResponse
    {
        [$headers, $rows] = match ($type) {
            'projets' => [
                ['ID', 'Projet', 'Client', 'Statut', 'Livraison', 'Chiffre d\'affaires', 'Encaissé', 'Reste à encaisser', 'Dépenses', 'Rémunérations prévues', 'Rémunérations versées', 'Remboursements pénalités', 'Marge nette'],
                FinanceService::projects()->map(fn ($p) => [$p['id'], $p['name'], $p['client'], $p['status_label'], $p['delivery_date'], $p['revenue'], $p['collected'], $p['remaining'], $p['expenses'], $p['fees_planned'], $p['fees_paid'], $p['refunds'], $p['margin']]),
            ],
            'encaissements' => [
                ['Reçu', 'Date', 'Projet', 'Client', 'Tranche', 'Montant', 'Moyen', 'Référence', 'Note', 'Enregistré par'],
                ClientPayment::with(['project', 'client', 'recorder'])->orderBy('paid_at')->get()->map(fn ($p) => [$p->receipt_number, $p->paid_at->format('Y-m-d H:i'), $p->project?->name, $p->client?->name, $p->type->label(), $p->amount, $p->method->label(), $p->reference, $p->note, $p->recorder?->name]),
            ],
            'remunerations' => [
                ['Reçu', 'Date', 'Membre', 'Projet', 'Tâche', 'Brut', 'Pénalité retenue', 'Net versé', 'Moyen', 'Référence', 'Payé par'],
                MemberPayment::with(['user', 'project', 'task', 'payer'])->orderBy('paid_at')->get()->map(fn ($p) => [$p->receipt_number, $p->paid_at->format('Y-m-d H:i'), $p->user?->name, $p->project?->name, $p->task?->name, $p->gross_amount, $p->penalty_deducted, $p->net_amount, $p->method->label(), $p->reference, $p->payer?->name]),
            ],
            'depenses' => [
                ['Date', 'Projet', 'Activité', 'Description', 'Fournisseur', 'Montant', 'Enregistré par'],
                Expense::with(['project', 'activity', 'recorder'])->orderBy('spent_at')->get()->map(fn ($e) => [$e->spent_at->format('Y-m-d'), $e->project?->name, $e->activity?->name, $e->description, $e->supplier, $e->amount, $e->recorder?->name]),
            ],
            'penalites' => [
                ['Date', 'Membre', 'Type', 'Tâche', 'Jours de retard', 'Montant', 'Par', 'Note / motif'],
                Penalty::with(['user', 'task', 'canceller'])->orderBy('accrued_at')->get()->flatMap(fn ($p) => array_filter([
                    [$p->accrued_at->format('Y-m-d H:i'), $p->user?->name, 'Pénalité comptée', $p->task?->name, $p->days_late, $p->amount, '', ''],
                    $p->cancelled_at ? [$p->cancelled_at->format('Y-m-d H:i'), $p->user?->name, 'Pénalité annulée', $p->task?->name, $p->days_late, -$p->amount, $p->canceller?->name, $p->cancel_reason] : null,
                ]))
                    ->concat(PenaltyRefund::with(['user', 'task', 'refunder'])->orderBy('refunded_at')->get()->map(fn ($r) => [$r->refunded_at->format('Y-m-d H:i'), $r->user?->name, "Remboursement {$r->receipt_number} ({$r->method->label()})", $r->task?->name, '', $r->amount, $r->refunder?->name, $r->reason]))
                    ->concat(PenaltySettlement::with(['user', 'collector'])->orderBy('settled_at')->get()->map(fn ($s) => [$s->settled_at->format('Y-m-d H:i'), $s->user?->name, $s->type === 'withheld' ? 'Retenue sur versement' : 'Paiement direct', '', '', -$s->amount, $s->collector?->name, $s->note])),
            ],
            'membres' => [
                ['Membre', 'Rôle', 'Tâches', 'Terminées', 'En retard', 'Pénalisées', 'Rémunération totale', 'Versé brut', 'Versé net', 'Reste dû', 'Pénalités', 'Pénalités dues'],
                FinanceService::members()->map(fn ($m) => [$m['name'], $m['role_label'], $m['tasks'], $m['done'], $m['late'], $m['penalized'], $m['fees_total'], $m['gross_paid'], $m['net_paid'], $m['remaining'], $m['penalties'], $m['penalty_debt']]),
            ],
            default => abort(404),
        };

        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel reads accents
            fputcsv($out, $headers, ';', '"', '');
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($v) => $v ?? '', $row), ';', '"', '');
            }
            fclose($out);
        }, "fotsography-{$type}-".now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
