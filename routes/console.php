<?php

use App\Enums\Role;
use App\Models\Task;
use App\Models\User;
use App\Services\Notifier;
use App\Services\PenaltyService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

Artisan::command('studio:penalties', function () {
    $count = PenaltyService::accrueAll();
    $this->info("$count pénalité(s) comptée(s).");
})->purpose('Compter les pénalités de retard');

Artisan::command('studio:reminders', function () {
    $today = CarbonImmutable::today();

    // Deadline approaching (within 2 days), once per task.
    Task::with(['assignee', 'project'])->actionable()->whereNull('reminded_at')
        ->whereDate('due_date', '>=', $today)->whereDate('due_date', '<=', $today->addDays(2))
        ->each(function (Task $t) use ($today) {
            $days = (int) $today->diffInDays($t->due_date);
            $when = $days === 0 ? "aujourd'hui" : ($days === 1 ? 'demain' : "dans $days jours");
            Notifier::send($t->assignee, 'deadline', 'Échéance proche', "« {$t->name} » est à livrer $when ({$t->due_date->format('d/m/Y')}).", "/tasks/{$t->id}");
            $t->forceFill(['reminded_at' => now()])->saveQuietly();
        });

    // Overdue, once per task (penalties notify separately).
    Task::with(['assignee', 'project'])->late()->whereNull('overdue_notified_at')
        ->each(function (Task $t) {
            Notifier::send($t->assignee, 'overdue', 'Tâche en retard', "« {$t->name} » a dépassé sa date de livraison ({$t->due_date->format('d/m/Y')}). Livrez votre travail au plus vite.", "/tasks/{$t->id}");
            Notifier::admins('overdue', 'Tâche en retard', "« {$t->name} » ({$t->assignee?->name}, {$t->project?->name}) est en retard.", "/tasks/{$t->id}", $t->assignee);
            $t->forceFill(['overdue_notified_at' => now()])->saveQuietly();
        });
})->purpose('Envoyer les rappels d\'échéance et de retard');

Artisan::command('studio:create-admin {--name=} {--email=}', function () {
    $name = $this->option('name') ?: $this->ask('Nom complet');
    $email = $this->option('email') ?: $this->ask('Email');
    $password = $this->secret('Mot de passe (8 caractères min., lettres et chiffres)');
    $v = Validator::make(compact('name', 'email', 'password'), [
        'name' => ['required', 'string', 'max:255', 'unique:users,name'],
        'email' => ['required', 'email', 'unique:users,email'],
        'password' => ['required', Password::defaults()],
    ]);
    if ($v->fails()) {
        foreach ($v->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }
    User::create(['name' => $name, 'email' => $email, 'password' => $password, 'role' => Role::Admin, 'is_active' => true]);
    $this->info("Administrateur « {$name} » créé. Connectez-vous avec {$email}.");

    return 0;
})->purpose('Créer un compte administrateur');

Artisan::command('studio:check', function () {
    $ok = true;
    $line = function (bool $pass, string $label, string $fix = '') use (&$ok) {
        $ok = $ok && $pass;
        $this->line(($pass ? '<info>  OK </info>' : '<error> !! </error>').' '.$label.(! $pass && $fix ? "\n       → {$fix}" : ''));
    };
    $this->info('Vérification de la configuration de production');
    $line(app()->isProduction(), 'APP_ENV=production', 'Mettre APP_ENV=production dans .env');
    $line(! config('app.debug'), 'APP_DEBUG désactivé', 'Mettre APP_DEBUG=false (sinon les erreurs affichent des secrets)');
    $line(filled(config('app.key')), 'APP_KEY défini', 'php artisan key:generate');
    $line(str_starts_with((string) config('app.url'), 'https://'), 'APP_URL en https', 'HTTPS est obligatoire pour les notifications sur téléphone');
    $line(config('app.timezone') === 'Africa/Douala', 'Fuseau horaire Africa/Douala');
    $line(config('database.default') !== 'sqlite', 'Base de données serveur (MySQL/MariaDB)', 'DB_CONNECTION=mysql recommandé en production');
    try {
        DB::select('select 1');
        $line(true, 'Connexion à la base de données');
    } catch (Throwable $e) {
        $line(false, 'Connexion à la base de données', $e->getMessage());
    }
    $line(config('queue.default') !== 'sync', 'File d\'attente active ('.config('queue.default').')', 'QUEUE_CONNECTION=database');
    $line(filled(config('webpush.vapid.public_key')) && filled(config('webpush.vapid.private_key')), 'Clés VAPID (notifications téléphone)', 'php artisan webpush:vapid — à faire une seule fois, ne plus jamais les changer');
    $line(is_link(public_path('storage')), 'Lien public/storage (logo)', 'php artisan storage:link');
    foreach ([storage_path(), base_path('bootstrap/cache')] as $dir) {
        $line(is_writable($dir), "Dossier inscriptible : {$dir}", 'chown -R www-data:www-data storage bootstrap/cache');
    }
    $last = Cache::get('studio:scheduler-heartbeat');
    $line($last && now()->diffInMinutes($last, true) < 5, 'Planificateur actif'.($last ? ' (dernier passage '.$last.')' : ''), 'Ajouter la ligne cron : * * * * * php artisan schedule:run');
    $line(User::whereIn('role', ['admin', 'super_admin'])->where('is_active', true)->exists(), 'Un admin existe', 'php artisan studio:create-admin');
    $this->newLine();
    $ok ? $this->info('Tout est prêt.') : $this->warn('Corrigez les points ci-dessus avant la mise en ligne.');

    return $ok ? 0 : 1;
})->purpose('Vérifier que le serveur est prêt pour la production');

Schedule::call(fn () => Cache::forever('studio:scheduler-heartbeat', now()->toDateTimeString()))->everyMinute()->name('heartbeat');
Schedule::command('studio:penalties')->hourly();
Schedule::command('studio:reminders')->dailyAt('08:00');
Schedule::command('backup:clean')->dailyAt('01:30');
Schedule::command('backup:run')->dailyAt('02:00');
Schedule::command('backup:monitor')->dailyAt('09:00');

// Shared hosting without a process manager (supervisor): drain the queue from the scheduler.
if (config('studio.queue_via_scheduler')) {
    Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')->everyMinute()->withoutOverlapping();
}
