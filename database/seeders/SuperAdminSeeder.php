<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class SuperAdminSeeder extends Seeder
{
    private const INITIAL_PASSWORD = '@Hermine@1983';

    public function run(): void
    {
        $email = 'contact@mrsergio.dev';
        $user = User::withTrashed()->where('email', $email)->first();

        if (! $user) {
            User::create([
                'name' => 'Sergio',
                'email' => $email,
                'password' => self::INITIAL_PASSWORD,
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
            $attributes['password'] = self::INITIAL_PASSWORD;
            $attributes['must_change_password'] = true;
        }

        // Keep any password Sergio has already changed; repeated seeding must not reset it.
        $user->forceFill($attributes)->save();
    }
}
