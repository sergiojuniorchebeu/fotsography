<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Models\Client;
use App\Models\Project;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\TaskReview;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\PenaltyService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Auth;

/**
 * Demo data. All accounts use the password "password".
 * php artisan migrate:fresh --seed && php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        StudioSetting::current()->update(['address' => 'Bonapriso, Douala', 'phone' => '+237 699 00 00 00', 'email' => 'contact@fotsography.cm', 'niu_rccm' => 'M0123456789X / RC/DLA/2024/B/1234']);

        $admin = User::create(['name' => 'Junior Fotso', 'email' => 'admin@fotsography.cm', 'password' => 'password', 'role' => Role::Admin, 'phone' => '+237 699 11 22 33']);
        $assistant = User::create(['name' => 'Carine Mbarga', 'email' => 'assistant@fotsography.cm', 'password' => 'password', 'role' => Role::Assistant]);
        $photo = User::create(['name' => 'Paul Ndongo', 'email' => 'photo@fotsography.cm', 'password' => 'password', 'role' => Role::Photographe]);
        $video = User::create(['name' => 'Aïcha Bello', 'email' => 'video@fotsography.cm', 'password' => 'password', 'role' => Role::Videaste]);
        $edit = User::create(['name' => 'Eric Tchoumi', 'email' => 'montage@fotsography.cm', 'password' => 'password', 'role' => Role::Monteur]);
        Auth::login($admin);

        $today = CarbonImmutable::today();
        $c1 = Client::create(['name' => 'Famille Ngo Biyong', 'phone' => '+237 677 45 12 90', 'address' => 'Yaoundé, Bastos']);
        $c2 = Client::create(['name' => 'Orange Cameroun — Com.', 'phone' => '+237 690 00 11 22', 'email' => 'events@example.cm', 'address' => 'Douala, Akwa']);
        $c3 = Client::create(['name' => 'M. et Mme Kamga', 'phone' => '+237 655 31 08 44', 'address' => 'Bafoussam']);

        // Project 1: wedding, in progress, partly paid, one late task.
        $p1 = Project::create(['client_id' => $c1->id, 'name' => 'Mariage Ngo Biyong', 'location' => 'Yaoundé, Hilton', 'event_date' => $today->subDays(12), 'delivery_date' => $today->addDays(4), 'total_amount' => 1_500_000, 'status' => 'in_progress']);
        $a1 = $p1->activities()->create(['name' => 'Shooting']);
        $a2 = $p1->activities()->create(['name' => 'Retouche photos']);
        $a3 = $p1->activities()->create(['name' => 'Montage vidéo']);
        $t1 = Task::create(['activity_id' => $a1->id, 'project_id' => $p1->id, 'name' => 'Couverture photo de la cérémonie', 'instructions' => "Mairie + église + soirée.\nPrévoir 2 boîtiers.", 'assigned_to' => $photo->id, 'due_date' => $today->subDays(10), 'client_share' => 400_000, 'member_fee' => 100_000, 'status' => TaskStatus::Done, 'submitted_at' => $today->subDays(11), 'validated_at' => $today->subDays(10), 'validated_by' => $admin->id, 'proof_url' => 'https://drive.google.com/demo-ceremonie']);
        TaskReview::create(['task_id' => $t1->id, 'user_id' => $photo->id, 'action' => 'submitted', 'proof_url' => $t1->proof_url]);
        TaskReview::create(['task_id' => $t1->id, 'user_id' => $admin->id, 'action' => 'validated', 'comment' => 'Très beau travail.']);
        // Chain: the retouche starts after the shooting (validated), the album after the retouche (waiting).
        $t2 = Task::create(['activity_id' => $a2->id, 'project_id' => $p1->id, 'depends_on_id' => $t1->id, 'name' => 'Retouche des 300 photos sélectionnées', 'instructions' => 'Style lumineux, peau naturelle. Export JPG 4K.', 'assigned_to' => $edit->id, 'due_date' => $today->subDays(3), 'client_share' => 200_000, 'member_fee' => 80_000, 'status' => TaskStatus::InProgress, 'started_at' => $today->subDays(9)]);
        TaskReview::create(['task_id' => $t2->id, 'user_id' => $edit->id, 'action' => 'started']);
        Task::create(['activity_id' => $a2->id, 'project_id' => $p1->id, 'depends_on_id' => $t2->id, 'name' => 'Mise en page de l\'album', 'instructions' => '30 pages, format 30×30.', 'assigned_to' => $photo->id, 'due_date' => $today->addDays(3), 'client_share' => 100_000, 'member_fee' => 40_000]);
        $t3 = Task::create(['activity_id' => $a3->id, 'project_id' => $p1->id, 'name' => 'Film du mariage (8 min)', 'instructions' => 'Musique fournie par les mariés.', 'assigned_to' => $video->id, 'due_date' => $today->addDays(1), 'client_share' => 600_000, 'member_fee' => 150_000, 'status' => TaskStatus::Review, 'submitted_at' => now(), 'proof_url' => 'https://youtu.be/demo-film']);
        TaskReview::create(['task_id' => $t3->id, 'user_id' => $video->id, 'action' => 'submitted', 'proof_url' => $t3->proof_url, 'comment' => 'Version 1 du film.']);
        $p1->activities()->first()->expenses()->create(['project_id' => $p1->id, 'description' => 'Transport Douala–Yaoundé', 'supplier' => 'Général Voyages', 'amount' => 35_000, 'spent_at' => $today->subDays(13), 'recorded_by' => $admin->id]);
        PaymentService::recordClientPayment($p1, ['type' => 'advance', 'method' => 'mobile_money', 'reference' => 'MP2410.1234.A5678', 'paid_at' => $today->subMonths(3)], $admin);
        PaymentService::recordClientPayment($p1, ['type' => 'intermediate', 'method' => 'transfer', 'paid_at' => $today->subDays(12)], $admin);
        PaymentService::payMember($t1, ['amount' => 100_000, 'method' => 'mobile_money'], $admin);

        // Project 2: corporate event, fully paid -> final invoice.
        $p2 = Project::create(['client_id' => $c2->id, 'name' => 'Soirée de lancement produit', 'location' => 'Douala, Pullman', 'event_date' => $today->subDays(40), 'delivery_date' => $today->subDays(25), 'total_amount' => 900_000, 'status' => 'delivered']);
        $b1 = $p2->activities()->create(['name' => 'Couverture photo & vidéo']);
        $t4 = Task::create(['activity_id' => $b1->id, 'project_id' => $p2->id, 'name' => 'Photos corporate', 'assigned_to' => $photo->id, 'due_date' => $today->subDays(30), 'client_share' => 500_000, 'member_fee' => 90_000, 'status' => TaskStatus::Done, 'validated_at' => $today->subDays(29), 'validated_by' => $admin->id]);
        $b1->expenses()->create(['project_id' => $p2->id, 'description' => 'Location éclairage', 'supplier' => 'LightPro', 'amount' => 60_000, 'spent_at' => $today->subMonths(5)->addDays(3), 'recorded_by' => $admin->id]);
        foreach (['advance' => 5, 'intermediate' => 2, 'balance' => 1] as $type => $monthsAgo) {
            PaymentService::recordClientPayment($p2, ['type' => $type, 'method' => 'transfer', 'paid_at' => $today->subMonths($monthsAgo)], $admin);
        }
        PaymentService::payMember($t4, ['amount' => 90_000, 'method' => 'cash'], $admin);

        // Project 3: draft birthday.
        $p3 = Project::create(['client_id' => $c3->id, 'name' => 'Anniversaire 50 ans', 'location' => 'Bafoussam', 'event_date' => $today->addDays(15), 'delivery_date' => $today->addDays(30), 'total_amount' => 450_000, 'status' => 'draft']);
        $c1a = $p3->activities()->create(['name' => 'Shooting']);
        Task::create(['activity_id' => $c1a->id, 'project_id' => $p3->id, 'name' => 'Photos de la fête', 'assigned_to' => $photo->id, 'due_date' => $today->addDays(25), 'client_share' => 250_000, 'member_fee' => 60_000]);

        PenaltyService::accrueAll();
        Auth::logout();
    }
}
