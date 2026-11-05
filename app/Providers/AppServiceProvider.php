<?php

namespace App\Providers;

use App\Services\Notifier;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Spatie\Backup\Events\BackupHasFailed;
use Spatie\Backup\Events\UnhealthyBackupWasFound;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // Backup problems are reported to admins inside the app (no mail server needed).
        Event::listen(BackupHasFailed::class, fn (BackupHasFailed $e) => Notifier::admins('backup_failed', 'Échec de la sauvegarde', 'La sauvegarde automatique a échoué : '.$e->exception->getMessage(), '/'));
        Event::listen(UnhealthyBackupWasFound::class, fn () => Notifier::admins('backup_failed', 'Sauvegardes à vérifier', 'Aucune sauvegarde récente valide n\'a été trouvée. Vérifiez le serveur.', '/'));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        // Same rule everywhere (the team must be able to type it on a phone): 8+ chars, letters and digits.
        Password::defaults(fn (): Password => Password::min(8)->letters()->numbers());
    }
}
