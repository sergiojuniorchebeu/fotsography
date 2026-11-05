<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(): Response
    {
        $users = User::query()->withCount(['tasks', 'tasks as tasks_open_count' => fn ($q) => $q->where('status', '!=', 'done')])
            ->orderByRaw("CASE role WHEN 'admin' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END")->orderBy('name')->get()
            ->map(fn (User $u) => [
                ...$u->toPublic(),
                'must_change_password' => $u->must_change_password,
                'last_login_at' => $u->last_login_at?->toIso8601String(),
                'tasks_count' => $u->tasks_count,
                'tasks_open_count' => $u->tasks_open_count,
                'penalty_debt' => $u->penaltyDebt(),
            ]);

        return Inertia::render('team/index', ['users' => $users, 'roles' => Role::options()]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:users,name'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'role' => ['required', Rule::enum(Role::class)],
        ]);
        $password = $this->temporaryPassword();
        $user = User::create([...$data, 'password' => $password, 'must_change_password' => true, 'is_active' => true]);
        ActivityLog::record('created', "Compte créé pour {$user->name} ({$user->role->label()})", $user);

        return back()->with('success', "Compte de {$user->name} créé.")->with('credentials', $this->credentials($user, $password, true));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('users', 'name')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'role' => ['required', Rule::enum(Role::class)],
        ]);
        if ($user->isAdmin() && $data['role'] !== Role::Admin->value && $this->isLastAdmin($user)) {
            return back()->with('error', 'Impossible : c\'est le dernier administrateur actif.');
        }
        $oldRole = $user->role->label();
        $user->update($data);
        ActivityLog::record('updated', "Compte de {$user->name} modifié".($oldRole !== $user->role->label() ? " (rôle : $oldRole → {$user->role->label()})" : ''), $user);

        return back()->with('success', 'Membre mis à jour.');
    }

    public function toggle(Request $request, User $user): RedirectResponse
    {
        if ($user->id === $request->user()->id) {
            return back()->with('error', 'Vous ne pouvez pas désactiver votre propre compte.');
        }
        if ($user->is_active && $user->isAdmin() && $this->isLastAdmin($user)) {
            return back()->with('error', 'Impossible : c\'est le dernier administrateur actif.');
        }
        $user->update(['is_active' => ! $user->is_active]);
        ActivityLog::record('updated', "Compte de {$user->name} ".($user->is_active ? 'réactivé' : 'désactivé'), $user);

        return back()->with('success', $user->is_active ? 'Compte réactivé.' : 'Compte désactivé.');
    }

    public function resetPassword(User $user): RedirectResponse
    {
        $password = $this->temporaryPassword();
        $user->forceFill(['password' => $password, 'must_change_password' => true])->save();
        ActivityLog::record('updated', "Mot de passe de {$user->name} réinitialisé", $user);

        return back()->with('success', "Mot de passe de {$user->name} réinitialisé.")->with('credentials', $this->credentials($user, $password, false));
    }

    /** Shown once in a dialog so the admin can copy it and send it to the member. */
    private function credentials(User $user, string $password, bool $new): array
    {
        return ['name' => $user->name, 'email' => $user->email, 'phone' => $user->phone, 'password' => $password, 'new' => $new, 'login_url' => url('/login')];
    }

    private function isLastAdmin(User $user): bool
    {
        return User::where('role', Role::Admin)->where('is_active', true)->whereKeyNot($user->id)->doesntExist();
    }

    private function temporaryPassword(): string
    {
        return 'Fst-'.Str::upper(Str::random(4)).'-'.random_int(1000, 9999);
    }
}
