<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\StudioSetting;
use App\Services\PenaltyService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function edit(): Response
    {
        $s = StudioSetting::current();

        return Inertia::render('settings/index', [
            'settings' => [...$s->except(['id', 'created_at', 'updated_at', 'logo_path']), 'logo_url' => $s->logoUrl()],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'studio_name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'niu_rccm' => ['nullable', 'string', 'max:255'],
            'receipt_prefix' => ['required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/'],
            'plan_advance_pct' => ['required', 'integer', 'between:0,100'],
            'plan_intermediate_pct' => ['required', 'integer', 'between:0,100'],
            'plan_balance_pct' => ['required', 'integer', 'between:0,100'],
            'task_delivery_offset_days' => ['required', 'integer', 'between:0,365'],
            'penalties_enabled' => ['required', 'boolean'],
            'penalty_amount' => ['required', 'integer', 'min:0'],
            'penalty_interval_days' => ['required', 'integer', 'between:1,365'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'remove_logo' => ['nullable', 'boolean'],
        ]);

        if ($data['plan_advance_pct'] + $data['plan_intermediate_pct'] + $data['plan_balance_pct'] !== 100) {
            throw ValidationException::withMessages(['plan_advance_pct' => 'La somme des pourcentages doit faire 100 %.']);
        }

        $s = StudioSetting::current();
        $wasEnabled = $s->penalties_enabled;

        if (! empty($data['remove_logo']) && $s->logo_path) {
            Storage::disk('public')->delete($s->logo_path);
            $s->logo_path = null;
        }
        if ($request->hasFile('logo')) {
            $s->logo_path = $request->file('logo')->store('branding', 'public');
        }
        unset($data['logo'], $data['remove_logo']);
        $data['receipt_prefix'] = strtoupper($data['receipt_prefix']);

        $s->fill($data);
        $changes = $s->getDirty();
        $s->save();
        StudioSetting::flush();

        if (! $wasEnabled && $s->penalties_enabled) {
            // No retroactive penalties for the time the module was switched off.
            PenaltyService::reanchorAllLate();
        }

        ActivityLog::record('updated', 'Réglages du studio modifiés', $s, $changes);

        return back()->with('success', 'Réglages enregistrés.');
    }
}
