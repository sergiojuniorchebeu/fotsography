<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use App\Services\ProductionDatabaseReset;
use Illuminate\Database\Console\Migrations\FreshCommand;
use Illuminate\Database\Console\Migrations\RefreshCommand;
use Illuminate\Database\Console\WipeCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Mockery;
use ReflectionProperty;
use Tests\TestCase;

class ProductionDatabaseResetTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        DB::prohibitDestructiveCommands(false);
        parent::tearDown();
    }

    public function test_migrate_force_is_allowed_when_destructive_commands_are_prohibited(): void
    {
        $this->setProductionEnvironment();
        DB::prohibitDestructiveCommands(true);

        $exitCode = Artisan::call('migrate', ['--force' => true]);

        $this->assertSame(0, $exitCode);
        $this->assertStringNotContainsString('prohibited', Artisan::output());
    }

    public function test_direct_migrate_fresh_remains_blocked_in_production(): void
    {
        $this->setProductionEnvironment();
        DB::prohibitDestructiveCommands(true);

        $exitCode = Artisan::call('migrate:fresh', ['--force' => true]);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('prohibited', Artisan::output());
    }

    public function test_reset_command_rejects_an_invalid_admin_password_without_running_reset(): void
    {
        $this->setProductionEnvironment();
        $reset = Mockery::mock(ProductionDatabaseReset::class);
        $reset->shouldNotReceive('run');
        $this->app->instance(ProductionDatabaseReset::class, $reset);

        $this->artisan('studio:reset-production-database')
            ->expectsQuestion('Email du compte administrateur actif', 'admin@example.test')
            ->expectsQuestion('Mot de passe administrateur', 'wrong-password')
            ->expectsOutputToContain('Authentification administrateur refusée')
            ->assertExitCode(1);
    }

    public function test_reset_command_requires_the_exact_destructive_confirmation(): void
    {
        $this->setProductionEnvironment();
        User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'password' => 'Admin-Password123',
            'role' => Role::Admin,
            'is_active' => true,
        ]);
        $reset = Mockery::mock(ProductionDatabaseReset::class);
        $reset->shouldNotReceive('run');
        $this->app->instance(ProductionDatabaseReset::class, $reset);

        $this->artisan('studio:reset-production-database')
            ->expectsQuestion('Email du compte administrateur actif', 'admin@example.test')
            ->expectsQuestion('Mot de passe administrateur', 'Admin-Password123')
            ->expectsQuestion('Pour confirmer, tapez exactement RESET FOTSOGRAPHY DATABASE', 'RESET')
            ->expectsOutputToContain('Confirmation incorrecte')
            ->assertExitCode(1);
    }

    public function test_reset_command_runs_only_after_admin_authentication_and_confirmation(): void
    {
        $this->setProductionEnvironment();
        User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'password' => 'Admin-Password123',
            'role' => Role::Admin,
            'is_active' => true,
        ]);
        $reset = Mockery::mock(ProductionDatabaseReset::class);
        $reset->shouldReceive('run')->once()->andReturn(['exit_code' => 0, 'output' => 'Migrations executed.']);
        $this->app->instance(ProductionDatabaseReset::class, $reset);

        $this->artisan('studio:reset-production-database')
            ->expectsQuestion('Email du compte administrateur actif', 'admin@example.test')
            ->expectsQuestion('Mot de passe administrateur', 'Admin-Password123')
            ->expectsQuestion('Pour confirmer, tapez exactement RESET FOTSOGRAPHY DATABASE', 'RESET FOTSOGRAPHY DATABASE')
            ->expectsOutputToContain('Réinitialisation terminée')
            ->assertExitCode(0);
    }

    public function test_reset_temporarily_allows_only_fresh_and_restores_production_protection(): void
    {
        $this->setProductionEnvironment();
        DB::prohibitDestructiveCommands(true);

        Artisan::shouldReceive('call')
            ->once()
            ->with('migrate:fresh', ['--force' => true])
            ->andReturnUsing(function () {
                $this->assertFalse($this->commandIsProhibited(FreshCommand::class));
                $this->assertFalse($this->commandIsProhibited(WipeCommand::class));
                $this->assertTrue($this->commandIsProhibited(RefreshCommand::class));

                return 0;
            });
        Artisan::shouldReceive('output')->once()->andReturn('Migrations executed.');

        $result = (new ProductionDatabaseReset)->run();

        $this->assertSame(['exit_code' => 0, 'output' => 'Migrations executed.'], $result);
        $this->assertTrue($this->commandIsProhibited(FreshCommand::class));
        $this->assertTrue($this->commandIsProhibited(WipeCommand::class));
        $this->assertTrue($this->commandIsProhibited(RefreshCommand::class));
    }

    private function setProductionEnvironment(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
    }

    /** @param class-string $command */
    private function commandIsProhibited(string $command): bool
    {
        return (new ReflectionProperty($command, 'prohibitedFromRunning'))->getValue();
    }
}
