<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Services\ProductionDatabaseReset;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ResetProductionDatabase extends Command
{
    protected $signature = 'studio:reset-production-database';

    protected $description = 'Réinitialiser volontairement la base de production après authentification et confirmation';

    public function handle(ProductionDatabaseReset $reset): int
    {
        if (! app()->isProduction()) {
            $this->error('Cette commande est réservée à l’environnement de production.');

            return self::FAILURE;
        }

        if (! $this->input->isInteractive()) {
            $this->error('Cette commande exige un terminal interactif.');

            return self::FAILURE;
        }

        $email = trim((string) $this->ask('Email du compte administrateur actif'));
        $password = (string) $this->secret('Mot de passe administrateur');
        $admin = User::query()
            ->where('email', $email)
            ->where('role', Role::Admin)
            ->where('is_active', true)
            ->first();

        if (! $admin || ! Hash::check($password, $admin->password)) {
            $this->error('Authentification administrateur refusée. Aucune donnée n’a été modifiée.');

            return self::FAILURE;
        }

        $this->newLine();
        $this->components->warn('ATTENTION : cette opération supprimera définitivement toutes les tables et toutes les données, puis rejouera les migrations.');
        $this->components->warn('Les comptes, projets, tâches, paiements et autres données de cette base seront perdus.');
        $this->newLine();

        if ($this->ask('Pour confirmer, tapez exactement RESET FOTSOGRAPHY DATABASE') !== 'RESET FOTSOGRAPHY DATABASE') {
            $this->error('Confirmation incorrecte. Aucune donnée n’a été modifiée.');

            return self::FAILURE;
        }

        $result = $reset->run();
        if ($result['output'] !== '') {
            $this->output->write($result['output']);
        }

        if ($result['exit_code'] !== self::SUCCESS) {
            $this->error('La réinitialisation a échoué. Consultez la sortie ci-dessus.');

            return self::FAILURE;
        }

        $this->info('Réinitialisation terminée. Les migrations sont à jour.');

        return self::SUCCESS;
    }
}
