<?php

namespace Database\Seeders;

use App\Models\StudioSetting;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Only the studio settings are seeded: the first person who registers becomes the admin.
     * Run `php artisan db:seed --class=DemoSeeder` for demo data.
     */
    public function run(): void
    {
        StudioSetting::current();
    }
}
