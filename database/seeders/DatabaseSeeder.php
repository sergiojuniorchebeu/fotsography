<?php

namespace Database\Seeders;

use App\Models\StudioSetting;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed core settings and the reserved developer account. Demo data is opt-in.
     */
    public function run(): void
    {
        StudioSetting::current();
        $this->call(SuperAdminSeeder::class);
    }
}
