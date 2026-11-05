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
        $filters = $request->only(['action', 'user', 'q']);
        $logs = ActivityLog::query()->with('user')
            ->when($filters['action'] ?? null, fn ($q, $v) => $q->where('action', $v))
            ->when($filters['user'] ?? null, fn ($q, $v) => $q->where('user_id', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where('description', 'like', "%$v%"))
            ->latest('id')->paginate(50)->withQueryString()
            ->through(fn ($l) => [
                'id' => $l->id, 'action' => $l->action, 'description' => $l->description, 'subject_type' => $l->subject_type,
                'properties' => $l->properties, 'user' => $l->user?->name, 'ip' => $l->ip_address, 'created_at' => $l->created_at->toIso8601String(),
            ]);

        return Inertia::render('activity-log/index', [
            'logs' => $logs,
            'filters' => $filters,
            'users' => User::withTrashed()->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
