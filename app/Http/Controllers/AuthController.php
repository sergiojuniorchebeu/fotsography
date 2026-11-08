<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function showLogin(): Response|RedirectResponse
    {
        if (! self::nonSuperAdminAccountExists()) {
            return redirect('/register');
        }

        return Inertia::render('auth/login');
    }

    public function login(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'login' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        $key = 'login:'.Str::lower($data['login']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['login' => 'Trop de tentatives. Réessayez dans '.RateLimiter::availableIn($key).' secondes.']);
        }

        // Email or full name, case-insensitive (also for accented names, which SQL LOWER() may not fold).
        $login = Str::lower(Str::squish($data['login']));
        $user = User::query()->get()
            ->filter(fn (User $u) => Str::lower($u->email) === $login || Str::lower(Str::squish($u->name)) === $login)
            ->first(fn (User $u) => Hash::check($data['password'], $u->password));

        if (! $user) {
            RateLimiter::hit($key);
            throw ValidationException::withMessages(['login' => 'Identifiants incorrects.']);
        }
        if (! $user->is_active) {
            throw ValidationException::withMessages(['login' => 'Votre compte est désactivé. Contactez l\'administrateur.']);
        }

        RateLimiter::clear($key);
        Auth::login($user, (bool) ($data['remember'] ?? false));
        $request->session()->regenerate();
        $user->forceFill(['last_login_at' => now()])->save();

        return redirect()->intended('/');
    }

    public function showRegister(): Response|RedirectResponse
    {
        if (self::nonSuperAdminAccountExists()) {
            return redirect('/login');
        }

        return Inertia::render('auth/register');
    }

    public function register(Request $request): RedirectResponse
    {
        abort_if(self::nonSuperAdminAccountExists(), 403, 'L\'inscription est fermée.');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:users,name'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = User::create([...$data, 'role' => Role::Admin, 'is_active' => true]);
        Auth::login($user);
        $request->session()->regenerate();
        ActivityLog::record('created', 'Compte administrateur initial créé', $user);

        return redirect('/')->with('success', 'Bienvenue ! Vous êtes l\'administrateur du studio.');
    }

    private static function nonSuperAdminAccountExists(): bool
    {
        return User::withTrashed()->where('role', '!=', Role::SuperAdmin)->exists();
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }

    public function showChangePassword(): Response
    {
        return Inertia::render('auth/change-password');
    }

    public function changePassword(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', 'different:current_password', Password::defaults()],
        ]);
        $user->forceFill(['password' => $data['password'], 'must_change_password' => false])->save();
        ActivityLog::record('updated', 'Mot de passe modifié', $user);

        return redirect('/')->with('success', 'Mot de passe mis à jour.');
    }
}
