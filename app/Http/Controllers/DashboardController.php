<?php

namespace App\Http\Controllers;

use App\Enums\ProjectStatus;
use App\Enums\TaskStatus;
use App\Models\Client;
use App\Models\ClientPayment;
use App\Models\Project;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\User;
use App\Services\FinanceService;
use App\Services\PenaltyService;
use App\Support\Present;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        PenaltyService::accrueAll();

        if ($user->isMember()) {
            return $this->member($user);
        }

        $today = CarbonImmutable::today();
        $present = fn ($q) => $q->with(['assignee', 'project', 'activity', 'dependency.assignee'])->get()->map(fn ($t) => Present::task($t, $user));

        $base = [
            'role' => $user->role->value,
            'taskCounts' => [
                'todo' => Task::actionable()->where('status', 'todo')->count(),
                'in_progress' => Task::where('status', 'in_progress')->count(),
                'waiting' => Task::waiting()->count(),
                'review' => Task::where('status', 'review')->count(),
                'done' => Task::where('status', 'done')->count(),
                'late' => Task::late()->count(),
            ],
            'workload' => Present::assignable()->filter(fn ($m) => $m['role'] !== 'assistant' || $m['open_count'] + $m['review_count'] > 0)->values(),
            'toReview' => $present(Task::where('status', 'review')->orderBy('submitted_at')->limit(8)),
            'upcoming' => $present(Task::actionable()->whereDate('due_date', '>=', $today)->orderBy('due_date')->limit(8)),
            'late' => $present(Task::late()->orderBy('due_date')->limit(8)),
            'projects' => Project::with('client')
                ->withCount(['tasks', 'tasks as tasks_done_count' => fn ($q) => $q->where('status', 'done')])
                ->whereIn('status', [ProjectStatus::Draft, ProjectStatus::InProgress])
                ->orderBy('delivery_date')->limit(8)->get()
                ->map(fn ($p) => Present::project($p, $user, true)),
        ];

        if ($user->isAdmin()) {
            $base['summary'] = FinanceService::summary();
            $base['monthly'] = FinanceService::monthly();
            $base['members'] = FinanceService::members();
            $settings = StudioSetting::current();
            $base['setup'] = [
                ['key' => 'studio', 'label' => 'Renseigner l\'identité du studio (adresse, téléphone, logo)', 'href' => '/settings', 'done' => (bool) ($settings->phone || $settings->address)],
                ['key' => 'team', 'label' => 'Créer les comptes de l\'équipe', 'href' => '/team', 'done' => User::count() > 1],
                ['key' => 'client', 'label' => 'Ajouter un premier client', 'href' => '/clients', 'done' => Client::exists()],
                ['key' => 'project', 'label' => 'Créer un projet, ses activités et ses tâches', 'href' => '/projects', 'done' => Project::exists()],
            ];
            $base['recentPayments'] = ClientPayment::with(['project', 'recorder'])->latest('paid_at')->limit(6)->get()->map(fn ($p) => Present::clientPayment($p));
        }

        return Inertia::render('dashboard', $base);
    }

    private function member(User $user): Response
    {
        $today = CarbonImmutable::today();
        $tasks = $user->tasks()->with(['project', 'activity', 'assignee', 'dependency.assignee'])->orderBy('due_date')->get();
        $payments = $user->memberPayments()->get();

        return Inertia::render('dashboard', [
            'role' => $user->role->value,
            'myTasks' => $tasks->where('status', '!=', TaskStatus::Done)->values()->map(fn ($t) => Present::task($t, $user)),
            'taskCounts' => [
                'todo' => $tasks->filter(fn ($t) => $t->status->isOpen() && ! $t->isWaiting())->count(),
                'waiting' => $tasks->filter(fn ($t) => $t->isWaiting())->count(),
                'review' => $tasks->where('status', TaskStatus::Review)->count(),
                'done' => $tasks->where('status', TaskStatus::Done)->count(),
                'late' => $tasks->filter(fn ($t) => $t->isLate())->count(),
            ],
            'earnings' => [
                'fees_total' => (int) $tasks->sum('member_fee'),
                'net_paid' => (int) $payments->sum('net_amount'),
                'remaining' => (int) $tasks->sum(fn ($t) => $t->remainingFee()),
                'penalty_debt' => $user->penaltyDebt(),
            ],
            'today' => $today->toDateString(),
        ]);
    }
}
