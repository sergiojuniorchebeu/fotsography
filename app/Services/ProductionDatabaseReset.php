<?php

namespace App\Services;

use Illuminate\Database\Console\Migrations\FreshCommand;
use Illuminate\Database\Console\WipeCommand;
use Illuminate\Support\Facades\Artisan;

class ProductionDatabaseReset
{
    /** @return array{exit_code: int, output: string} */
    public function run(): array
    {
        // AppServiceProvider keeps this command prohibited in production by default.
        // migrate:fresh invokes db:wipe internally, so allow only these two commands.
        FreshCommand::prohibit(false);
        WipeCommand::prohibit(false);

        try {
            $exitCode = Artisan::call('migrate:fresh', ['--force' => true]);

            return ['exit_code' => $exitCode, 'output' => Artisan::output()];
        } finally {
            FreshCommand::prohibit(app()->isProduction());
            WipeCommand::prohibit(app()->isProduction());
        }
    }
}
