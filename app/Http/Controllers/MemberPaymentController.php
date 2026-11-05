<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Models\Task;
use App\Services\PaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MemberPaymentController extends Controller
{
    public function store(Request $request, Task $task): RedirectResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', Rule::enum(PaymentMethod::class)],
            'reference' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $payment = PaymentService::payMember($task, $data, $request->user());

        return back()->with('success', "Versement enregistré — reçu {$payment->receipt_number}.");
    }
}
