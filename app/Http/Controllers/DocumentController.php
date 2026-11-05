<?php

namespace App\Http\Controllers;

use App\Models\ClientPayment;
use App\Models\Invoice;
use App\Models\MemberPayment;
use App\Models\PenaltyRefund;
use App\Models\StudioSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends Controller
{
    public function clientReceipt(ClientPayment $payment): Response
    {
        $payment->load(['project', 'client', 'recorder']);
        $project = $payment->project;
        $paidBefore = (int) $project->payments()->where('id', '<', $payment->id)->sum('amount');

        return $this->pdf('pdf.client-receipt', [
            'payment' => $payment,
            'project' => $project,
            'paidToDate' => $paidBefore + $payment->amount,
            'remaining' => max(0, $project->total_amount - $paidBefore - $payment->amount),
        ], "recu-{$payment->receipt_number}.pdf");
    }

    public function memberReceipt(Request $request, MemberPayment $payment): Response
    {
        $viewer = $request->user();
        abort_unless($viewer->isAdmin() || $payment->user_id === $viewer->id, 403);
        $payment->load(['task', 'project', 'user', 'payer']);

        return $this->pdf('pdf.member-receipt', ['payment' => $payment], "recu-{$payment->receipt_number}.pdf");
    }

    public function refundReceipt(Request $request, PenaltyRefund $refund): Response
    {
        $viewer = $request->user();
        abort_unless($viewer->isAdmin() || $refund->user_id === $viewer->id, 403);
        $refund->load(['user', 'task', 'project', 'refunder']);

        return $this->pdf('pdf.penalty-refund', ['refund' => $refund], "remboursement-{$refund->receipt_number}.pdf");
    }

    public function invoice(Invoice $invoice): Response
    {
        $invoice->load('project.client');
        $project = $invoice->project;

        return $this->pdf('pdf.invoice', [
            'invoice' => $invoice,
            'project' => $project,
            'payments' => $project->payments()->orderBy('paid_at')->get(),
            'lines' => $project->tasks()->where('client_share', '>', 0)->with('activity')->get(),
        ], "facture-{$invoice->number}.pdf");
    }

    /** @param array<string, mixed> $data */
    private function pdf(string $view, array $data, string $filename): Response
    {
        $settings = StudioSetting::current();
        $logo = null;
        if ($settings->logo_path && is_file($path = $settings->logoAbsolutePath())) {
            $logo = 'data:'.mime_content_type($path).';base64,'.base64_encode((string) file_get_contents($path));
        }

        return Pdf::loadView($view, [...$data, 'studio' => $settings, 'logo' => $logo])
            ->setPaper('a4')
            ->download($filename);
    }
}
