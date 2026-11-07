<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = 'contact@mrsergio.dev';
        $user = User::withTrashed()->where('email', $email)->first();

        if (! $user) {
            $password = $this->initialPassword();
            User::create([
                'name' => 'Sergio',
                'email' => $email,
                'password' => $password,
                'role' => Role::SuperAdmin,
                'is_active' => true,
                'must_change_password' => true,
            ]);

            return;
        }

        if ($user->trashed()) {
            $user->restore();
        }

        $attributes = [
            'name' => 'Sergio',
            'role' => Role::SuperAdmin,
            'is_active' => true,
        ];

        if (! $user->isSuperAdmin()) {
            $attributes['password'] = $this->initialPassword();
            $attributes['must_change_password'] = true;
        }

        // Keep any password Sergio has already changed; repeated seeding must not reset it.
        $user->forceFill($attributes)->save();
    }

    private function initialPassword(): string
    {
        if (! $this->command) {
            throw new \RuntimeException('Lancez ce seeder depuis le terminal pour saisir le mot de passe initial.');
        }

        $password = (string) $this->command->secret('Mot de passe initial du Super Admin');
        if ($password === '') {
            throw new \RuntimeException('Le mot de passe initial ne peut pas être vide.');
        }

        $confirmation = (string) $this->command->secret('Confirmez le mot de passe');
        if (! hash_equals($password, $confirmation)) {
            throw new \RuntimeException('Les mots de passe ne correspondent pas. Relancez le seeder.');
        }

        return $password;
    }
}
