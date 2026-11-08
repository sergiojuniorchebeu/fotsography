<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        $viewer = $request->user();
        $filters = $request->only(['action', 'user', 'q']);
        $logs = ActivityLog::query()->with('user')
            ->when(! $viewer->isSuperAdmin(), fn ($q) => $q->where(fn ($visible) => $visible->whereNull('user_id')->orWhereHas('user', fn ($u) => $u->where('role', '!=', \App\Enums\Role::SuperAdmin))))
            ->when($filters['action'] ?? null, fn ($q, $v) => $q->where('action', $v))
            ->when($filters['user'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where('description', 'like', "%$v%"))
            ->latest('id')->paginate(50)->withQueryString()
            ->through(fn ($l) => [
                'id' => $l->id, 'action' => $l->action, 'description' => $l->description, 'subject_type' => $l->subject_type,
                'properties' => $l->properties, 'user' => $l->user?->nameFor($viewer), 'ip' => $l->ip_address, 'created_at' => $l->created_at->toIso8601String(),
            ]);

        return Inertia::render('activity-log/index', [
            'logs' => $logs,
            'filters' => $filters,
            'users' => User::withTrashed()->when(! $viewer->isSuperAdmin(), fn ($q) => $q->where('role', '!=', \App\Enums\Role::SuperAdmin))->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
