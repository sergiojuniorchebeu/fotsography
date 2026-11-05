<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\ActivityLog;
use App\Models\Expense;
use App\Services\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function store(Request $request, Activity $activity): RedirectResponse
    {
        $expense = $activity->expenses()->create([
            ...$this->validated($request),
            'project_id' => $activity->project_id,
            'recorded_by' => $request->user()->id,
        ]);
        ActivityLog::record('created', "Dépense « {$expense->description} » de ".Money::fcfa($expense->amount)." ({$activity->name})", $expense);

        return back()->with('success', 'Dépense enregistrée.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        $before = $expense->amount;
        $expense->update($this->validated($request));
        ActivityLog::record('updated', "Dépense « {$expense->description} » modifiée", $expense, ['montant' => Money::fcfa($before).' → '.Money::fcfa($expense->amount)]);

        return back()->with('success', 'Dépense mise à jour.');
    }

    public function destroy(Expense $expense): RedirectResponse
    {
        $expense->delete();
        ActivityLog::record('deleted', "Dépense « {$expense->description} » (".Money::fcfa($expense->amount).') archivée', $expense);

        return back()->with('success', 'Dépense archivée.');
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'description' => ['required', 'string', 'max:255'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'integer', 'min:1'],
            'spent_at' => ['required', 'date'],
        ]);
    }
}
