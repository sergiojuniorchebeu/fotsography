<?php

namespace App\Http\Controllers;

use App\Enums\ClientPaymentType;
use App\Enums\PaymentMethod;
use App\Models\Project;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientPaymentController extends Controller
{
    public function store(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::enum(ClientPaymentType::class)],
            'amount' => ['nullable', 'integer', 'min:1', Rule::requiredIf($request->input('type') === 'free')],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
            'paid_at' => ['nullable', 'date', 'before_or_equal:now'],
        ]);
        $payment = PaymentService::recordClientPayment($project, $data, $request->user());

        return back()->with('success', "Encaissement enregistré — reçu {$payment->receipt_number}.");
    }
}
