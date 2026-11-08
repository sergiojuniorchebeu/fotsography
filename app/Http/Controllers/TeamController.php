<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Mail\AccountAccess;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::query()->when(! $request->user()->isSuperAdmin(), fn ($q) => $q->where('role', '!=', Role::SuperAdmin))
            ->withCount(['tasks', 'tasks as tasks_open_count' => fn ($q) => $q->where('status', '!=', 'done')])
            ->orderByRaw("CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 WHEN 'assistant' THEN 2 ELSE 3 END")->orderBy('name')->get()
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
            'role' => ['required', Rule::in(array_column(Role::options(), 'value'))],
        ]);
        $password = $this->temporaryPassword();
        $user = User::create([...$data, 'password' => $password, 'must_change_password' => true, 'is_active' => true]);
        ActivityLog::record('created', "Compte créé pour {$user->name} ({$user->role->label()})", $user);

        return back()->with('success', "Compte de {$user->name} créé.")->with('credentials', $this->credentials($user, $password, true, $this->mailAccess($user, $password, true)));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $allowedRoles = array_column(Role::options(), 'value');
        if ($user->isSuperAdmin() && $request->user()->isSuperAdmin()) {
            $allowedRoles[] = Role::SuperAdmin->value;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('users', 'name')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:50'],
            'role' => ['required', Rule::in($allowedRoles)],
        ]);
        $this->protectSuperAdmin($request, $user);
        abort_if($user->isSuperAdmin() && $data['role'] !== Role::SuperAdmin->value, 403, 'Le rôle Super Admin est réservé au seeder technique.');
        if ($user->isAdmin() && ! in_array($data['role'], [Role::Admin->value, Role::SuperAdmin->value], true) && $this->isLastAdmin($user)) {
            return back()->with('error', 'Impossible : c\'est le dernier administrateur actif.');
        }
        $oldRole = $user->role->label();
        $user->update($data);
        ActivityLog::record('updated', "Compte de {$user->name} modifié".($oldRole !== $user->role->label() ? " (rôle : $oldRole → {$user->role->label()})" : ''), $user);

        return back()->with('success', 'Membre mis à jour.');
    }

    public function toggle(Request $request, User $user): RedirectResponse
    {
        $this->protectSuperAdmin($request, $user);
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

    public function resetPassword(Request $request, User $user): RedirectResponse
    {
        $this->protectSuperAdmin($request, $user);
        $password = $this->temporaryPassword();
        $user->forceFill(['password' => $password, 'must_change_password' => true])->save();
        ActivityLog::record('updated', "Mot de passe de {$user->name} réinitialisé", $user);

        return back()->with('success', "Mot de passe de {$user->name} réinitialisé.")->with('credentials', $this->credentials($user, $password, false, $this->mailAccess($user, $password, false)));
    }

    /**
     * "Renvoyer par email" from the access dialog. The admin sends back the temporary password it was shown;
     * it is only accepted while it is still the member's current, unchanged temporary password.
     */
    public function sendAccess(Request $request, User $user): RedirectResponse
    {
        $this->protectSuperAdmin($request, $user);
        $password = (string) $request->validate(['password' => ['required', 'string']])['password'];
        if (! $user->must_change_password || ! Hash::check($password, $user->password)) {
            return back()->with('error', "{$user->name} a déjà choisi son mot de passe : réinitialisez-le pour lui envoyer de nouveaux accès.");
        }
        $sent = $this->mailAccess($user, $password, $user->last_login_at === null);

        return back()->with($sent ? 'success' : 'error', $sent ? "Accès envoyés à {$user->email}." : "L'email n'a pas pu partir. Vérifiez la configuration mail, ou copiez le message.")
            ->with('credentials', $this->credentials($user, $password, $user->last_login_at === null, $sent));
    }

    /** Shown once in a dialog so the admin can copy it, and tells whether the email left. */
    private function credentials(User $user, string $password, bool $new, bool $mailSent): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => $user->phone, 'password' => $password, 'new' => $new, 'login_url' => url('/login'), 'mail_sent' => $mailSent];
    }

    /** Sends the login details by email. A mail failure never blocks the account: the admin can still copy them. */
    private function mailAccess(User $user, string $password, bool $new): bool
    {
        try {
            Mail::to($user->email, $user->name)->send(new AccountAccess($user, $password, $new));

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    private function isLastAdmin(User $user): bool
    {
        return User::whereIn('role', [Role::Admin, Role::SuperAdmin])->where('is_active', true)->whereKeyNot($user->id)->doesntExist();
    }

    private function protectSuperAdmin(Request $request, User $target): void
    {
        abort_if($target->isSuperAdmin() && ! $request->user()->isSuperAdmin(), 404);
    }

    private function temporaryPassword(): string
    {
        return 'Fst-'.Str::upper(Str::random(4)).'-'.random_int(1000, 9999);
    }
}
