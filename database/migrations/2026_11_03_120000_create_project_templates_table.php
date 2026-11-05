<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            // {activities: [{name, tasks: [{key, name, instructions, role, from, days, member_fee, client_pct, after}]}]}
            $table->json('structure');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $t = fn ($key, $name, $role, $from, $days, $pct, $after = null, $instructions = null) => compact('key', 'name', 'role', 'from', 'days', 'after', 'instructions') + ['member_fee' => 0, 'client_pct' => $pct];
        $defaults = [
            [
                'name' => 'Mariage (photo + vidéo)',
                'description' => 'Couverture complète : shooting, tri, retouche, film et album.',
                'activities' => [
                    ['name' => 'Shooting', 'tasks' => [
                        $t('photo', 'Couverture photo du mariage', 'photographe', 'event', 0, 30, null, "Mairie, église, soirée.\nPrévoir 2 boîtiers et cartes de secours."),
                        $t('video', 'Tournage vidéo du mariage', 'videaste', 'event', 0, 25),
                    ]],
                    ['name' => 'Retouche photos', 'tasks' => [
                        $t('tri', 'Tri et sélection des photos', 'photographe', 'event', 3, 5, 'photo'),
                        $t('retouche', 'Retouche des photos sélectionnées', 'monteur', 'delivery', 7, 15, 'tri'),
                    ]],
                    ['name' => 'Montage vidéo', 'tasks' => [
                        $t('film', 'Montage du film', 'monteur', 'delivery', 4, 20, 'video'),
                    ]],
                    ['name' => 'Livraison', 'tasks' => [
                        $t('album', "Mise en page de l'album", 'photographe', 'delivery', 2, 5, 'retouche'),
                    ]],
                ],
            ],
            [
                'name' => "Événement d'entreprise",
                'description' => 'Photos de l\'événement, retouche rapide et vidéo récapitulative.',
                'activities' => [
                    ['name' => 'Couverture', 'tasks' => [
                        $t('photo', "Photos de l'événement", 'photographe', 'event', 0, 40),
                        $t('video', 'Tournage de la vidéo récap', 'videaste', 'event', 0, 20),
                    ]],
                    ['name' => 'Post-production', 'tasks' => [
                        $t('retouche', 'Sélection et retouche des photos', 'monteur', 'event', 2, 20, 'photo'),
                        $t('recap', 'Montage de la vidéo récap (2 min)', 'monteur', 'event', 4, 20, 'video'),
                    ]],
                ],
            ],
            [
                'name' => 'Séance photo (portrait, studio)',
                'description' => 'Une séance, puis la retouche des photos choisies.',
                'activities' => [
                    ['name' => 'Séance', 'tasks' => [
                        $t('seance', 'Séance photo', 'photographe', 'event', 0, 60),
                        $t('retouche', 'Retouche des photos choisies', 'monteur', 'delivery', 1, 40, 'seance'),
                    ]],
                ],
            ],
        ];
        foreach ($defaults as $d) {
            DB::table('project_templates')->insert([
                'name' => $d['name'], 'description' => $d['description'],
                'structure' => json_encode(['activities' => $d['activities']], JSON_UNESCAPED_UNICODE),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('project_templates');
    }
};
