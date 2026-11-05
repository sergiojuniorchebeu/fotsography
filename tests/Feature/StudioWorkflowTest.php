<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\TaskStatus;
use App\Models\Activity;
use App\Models\Client;
use App\Models\Penalty;
use App\Models\PenaltyRefund;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Models\StudioSetting;
use App\Models\Task;
use App\Models\User;
use App\Services\FinanceService;
use App\Services\PenaltyService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudioWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $assistant;

    private User $member;

    private Project $project;

    private Activity $activity;

    protected function setUp(): void
    {
        parent::setUp();
        StudioSetting::flush();
        CarbonImmutable::setTestNow('2026-06-10 10:00:00');
        $this->travelTo(CarbonImmutable::parse('2026-06-10 10:00:00'));
        $this->withoutVite();

        $this->admin = User::factory()->role(Role::Admin)->create(['name' => 'Admin Fotso']);
        $this->assistant = User::factory()->role(Role::Assistant)->create();
        $this->member = User::factory()->role(Role::Photographe)->create();
        $client = Client::create(['name' => 'Mme Ngo']);
        $this->project = Project::create([
            'client_id' => $client->id, 'name' => 'Mariage Ngo', 'delivery_date' => '2026-06-30',
            'total_amount' => 1_000_001, 'advance_pct' => 30, 'intermediate_pct' => 50, 'balance_pct' => 20, 'status' => 'in_progress',
        ]);
        $this->activity = $this->project->activities()->create(['name' => 'Shooting']);
    }

    private function task(array $attrs = []): Task
    {
        return Task::create([
            'activity_id' => $this->activity->id, 'project_id' => $this->project->id, 'name' => 'Photos cérémonie',
            'assigned_to' => $this->member->id, 'due_date' => '2026-06-25', 'member_fee' => 50_000, 'client_share' => 0, ...$attrs,
        ]);
    }

    public function test_first_registered_user_becomes_admin_then_registration_closes(): void
    {
        User::query()->forceDelete();
        $this->post('/register', ['name' => 'Boss', 'email' => 'b@x.cm', 'password' => 'secret123', 'password_confirmation' => 'secret123'])->assertRedirect('/');
        $this->assertSame(Role::Admin, User::first()->role);
        auth()->logout();
        $this->post('/register', ['name' => 'Other', 'email' => 'o@x.cm', 'password' => 'secret123', 'password_confirmation' => 'secret123'])->assertForbidden();
    }

    public function test_login_with_full_name_and_forced_password_change(): void
    {
        $this->member->update(['password' => 'Temp-1234', 'must_change_password' => true]);
        $this->post('/login', ['login' => strtoupper($this->member->name), 'password' => 'Temp-1234'])->assertRedirect('/');
        $this->get('/')->assertRedirect('/password/change');
        $this->put('/password/change', ['current_password' => 'Temp-1234', 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123'])->assertRedirect('/');
        $this->assertFalse($this->member->fresh()->must_change_password);
    }

    public function test_payment_plan_rounding_goes_to_balance(): void
    {
        $plan = $this->project->plan();
        $this->assertSame(300000, $plan['advance']);
        $this->assertSame(500000, $plan['intermediate']);
        $this->assertSame(200001, $plan['balance']);
    }

    public function test_client_payments_rules_and_final_invoice(): void
    {
        $this->actingAs($this->admin);
        $this->post("/projects/{$this->project->id}/payments", ['type' => 'advance', 'method' => 'cash'])->assertSessionHasNoErrors();
        $this->post("/projects/{$this->project->id}/payments", ['type' => 'advance', 'method' => 'cash'])->assertSessionHasErrors('type');
        $this->post("/projects/{$this->project->id}/payments", ['type' => 'free', 'amount' => 900_000, 'method' => 'cash'])->assertSessionHasErrors('amount');
        $this->post("/projects/{$this->project->id}/payments", ['type' => 'free', 'amount' => 100_000, 'method' => 'mobile_money'])->assertSessionHasNoErrors();
        $this->assertSame('FST-2026-00002', $this->project->payments()->latest('id')->first()->receipt_number);
        $this->assertNull($this->project->invoice);
        $this->post("/projects/{$this->project->id}/payments", ['type' => 'free', 'amount' => 600_001, 'method' => 'transfer'])->assertSessionHasNoErrors();
        $this->assertNotNull($this->project->fresh()->invoice);
        $this->get('/client-payments/'.$this->project->payments()->first()->id.'/receipt')->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->project->update(['status' => 'cancelled']);
    }

    public function test_cannot_pay_cancelled_project(): void
    {
        $this->project->update(['status' => 'cancelled']);
        $this->actingAs($this->admin)->post("/projects/{$this->project->id}/payments", ['type' => 'advance', 'method' => 'cash'])->assertSessionHasErrors('amount');
    }

    public function test_client_shares_cannot_exceed_project_amount_and_assistant_cannot_set_amounts(): void
    {
        $this->actingAs($this->admin)->post("/activities/{$this->activity->id}/tasks", [
            'name' => 'A', 'assigned_to' => $this->member->id, 'client_share' => 1_000_002, 'member_fee' => 10,
        ])->assertSessionHasErrors('client_share');

        $this->actingAs($this->assistant)->post("/activities/{$this->activity->id}/tasks", [
            'name' => 'B', 'assigned_to' => $this->member->id, 'client_share' => 5000, 'member_fee' => 5000,
        ])->assertSessionHasNoErrors();
        $t = Task::where('name', 'B')->first();
        $this->assertSame(0, $t->member_fee);
        $this->assertSame(0, $t->client_share);
        $this->assertSame('2026-06-25', $t->due_date->toDateString(), 'default = delivery − 5 days');
    }

    public function test_assistant_never_receives_money_fields(): void
    {
        $task = $this->task();
        $this->actingAs($this->assistant);
        $this->get("/projects/{$this->project->id}")->assertOk()->assertInertia(fn ($p) => $p
            ->missing('project.total_amount')->missing('financials')->missing('payments')
            ->missing('activities.0.tasks.0.member_fee')->missing('activities.0.tasks.0.client_share'));
        $this->get("/tasks/{$task->id}")->assertInertia(fn ($p) => $p->missing('task.member_fee'));
        $this->get('/finances')->assertForbidden();
        $this->get('/clients')->assertForbidden();
    }

    public function test_member_sees_only_own_tasks(): void
    {
        $other = User::factory()->create();
        $mine = $this->task();
        $theirs = $this->task(['assigned_to' => $other->id]);
        $this->actingAs($this->member);
        $this->get("/tasks/{$theirs->id}")->assertForbidden();
        $this->get("/tasks/{$mine->id}")->assertOk()->assertInertia(fn ($p) => $p->where('task.member_fee', 50000)->missing('task.client_share'));
        $this->get('/projects')->assertForbidden();
    }

    public function test_task_lifecycle_start_deliver_return_validate(): void
    {
        $task = $this->task();
        // Nothing at all: we need to know where the work is.
        $this->actingAs($this->member)->post("/tasks/{$task->id}/submit", ['proof_url' => '', 'proof_note' => ''])->assertSessionHasErrors('proof_note');
        $this->post("/tasks/{$task->id}/submit", ['proof_url' => 'pas un lien'])->assertSessionHasErrors('proof_url');

        $this->post("/tasks/{$task->id}/start")->assertSessionHasNoErrors();
        $this->assertSame(TaskStatus::InProgress, $task->fresh()->status);
        $this->assertNotNull($task->fresh()->started_at);

        // A message alone is enough (files left on the studio disk).
        $this->post("/tasks/{$task->id}/submit", ['proof_note' => 'Copié sur le disque du studio'])->assertSessionHasNoErrors();
        $this->assertSame(TaskStatus::Review, $task->fresh()->status);

        $this->actingAs($this->admin)->post("/tasks/{$task->id}/return", ['comment' => ''])->assertSessionHasErrors(['comment', 'corrections']);
        $this->post("/tasks/{$task->id}/return", ['comment' => 'Flou', 'corrections' => 'Refaire netteté'])->assertSessionHasNoErrors();
        $this->assertSame(TaskStatus::InProgress, $task->fresh()->status);

        $this->actingAs($this->member)->post("/tasks/{$task->id}/submit", ['proof_url' => 'https://drive.example.com/y']);
        $this->actingAs($this->admin)->post("/tasks/{$task->id}/validate")->assertSessionHasNoErrors();
        $this->assertSame(TaskStatus::Done, $task->fresh()->status);
        $this->assertSame(['validated', 'submitted', 'returned', 'submitted', 'started'], $task->fresh()->reviews->pluck('action')->all());

        $this->actingAs($this->member)->post("/tasks/{$task->id}/submit", ['proof_url' => 'https://x.cm'])->assertSessionHas('error');
        $this->assertGreaterThan(0, $this->member->notifications()->count());
    }

    public function test_chained_task_waits_without_penalty_then_receives_the_files(): void
    {
        $editor = User::factory()->role(Role::Monteur)->create();
        $shoot = $this->task(['name' => 'Shooting', 'due_date' => '2026-06-12']);
        $this->actingAs($this->admin)->post("/activities/{$this->activity->id}/tasks", [
            'name' => 'Retouche', 'assigned_to' => $editor->id, 'due_date' => '2026-06-14', 'depends_on_id' => $shoot->id, 'member_fee' => 30000,
        ])->assertSessionHasNoErrors();
        $edit = Task::where('name', 'Retouche')->firstOrFail();
        $this->assertTrue($edit->isWaiting());

        // No cycle: the shooting cannot wait on the retouche.
        $this->put("/tasks/{$shoot->id}", ['name' => 'Shooting', 'assigned_to' => $this->member->id, 'due_date' => '2026-06-12', 'depends_on_id' => $edit->id])
            ->assertSessionHasErrors('depends_on_id');

        // The editor cannot start yet, and is not penalized while the shooting is late.
        $this->actingAs($editor)->post("/tasks/{$edit->id}/start")->assertSessionHas('error');
        $this->travelTo(CarbonImmutable::parse('2026-06-20 09:00'));
        $this->assertSame(0, PenaltyService::accrue($edit->fresh()));
        $this->assertFalse($edit->fresh()->isLate());
        $this->assertGreaterThan(0, PenaltyService::accrue($shoot->fresh()));

        $this->actingAs($this->member)->post("/tasks/{$shoot->id}/submit", ['proof_url' => 'https://drive.example.com/raws']);
        $this->actingAs($this->admin)->post("/tasks/{$shoot->id}/validate")->assertSessionHasNoErrors();

        // Unblocked: notified, gets the raw files, and the late clock restarts from today.
        $this->assertSame(1, $editor->notifications()->where('data->kind', 'task_unblocked')->count());
        $this->actingAs($editor)->get("/tasks/{$edit->id}")->assertInertia(fn ($p) => $p->where('task.is_waiting', false)->where('task.dependency.delivery_url', 'https://drive.example.com/raws'));
        $this->assertSame(0, PenaltyService::accrue($edit->fresh()));
        $this->post("/tasks/{$edit->id}/start")->assertSessionHasNoErrors();
    }

    public function test_penalties_accrue_from_day_one_every_n_days_and_never_decrease(): void
    {
        $task = $this->task(['due_date' => '2026-06-10']);
        $this->assertSame(0, PenaltyService::accrue($task));

        $this->travelTo(CarbonImmutable::parse('2026-06-11 09:00')); // day 1
        $this->assertSame(1, PenaltyService::accrue($task->fresh()));
        $this->travelTo(CarbonImmutable::parse('2026-06-12 09:00')); // day 2
        $this->assertSame(0, PenaltyService::accrue($task->fresh()));
        $this->travelTo(CarbonImmutable::parse('2026-06-13 09:00')); // day 3
        $this->assertSame(1, PenaltyService::accrue($task->fresh()));
        $this->assertSame(20000, $this->member->penaltyDebt());

        // Due date pushed back: already counted stays, nothing new until late again.
        $this->actingAs($this->admin)->put("/tasks/{$task->id}", ['name' => $task->name, 'assigned_to' => $this->member->id, 'due_date' => '2026-06-20', 'member_fee' => 50000]);
        $this->assertSame(0, PenaltyService::accrue($task->fresh()));
        $this->assertSame(20000, $this->member->penaltyDebt());
        $this->travelTo(CarbonImmutable::parse('2026-06-21 09:00'));
        $this->assertSame(1, PenaltyService::accrue($task->fresh()));

        // Submission stops the clock.
        $this->actingAs($this->member)->post("/tasks/{$task->id}/submit", ['proof_url' => 'https://x.cm/a']);
        $this->travelTo(CarbonImmutable::parse('2026-06-30 09:00'));
        $this->assertSame(0, PenaltyService::accrue($task->fresh()));
        $this->assertSame(30000, $this->member->penaltyDebt());

        // Disabled module: no new penalty, debt kept.
        StudioSetting::current()->update(['penalties_enabled' => false]);
        $this->actingAs($this->admin)->post("/tasks/{$task->id}/return", ['comment' => 'x', 'corrections' => 'y']);
        $this->travelTo(CarbonImmutable::parse('2026-07-10 09:00'));
        $this->assertSame(0, PenaltyService::accrue($task->fresh()));
        $this->assertSame(30000, $this->member->penaltyDebt());
    }

    public function test_admin_tasks_never_penalized_nor_paid(): void
    {
        $task = $this->task(['assigned_to' => $this->admin->id, 'due_date' => '2026-06-01']);
        $this->assertSame(0, PenaltyService::accrue($task));
        $this->actingAs($this->admin)->post("/tasks/{$task->id}/payments", ['amount' => 1000, 'method' => 'cash'])->assertSessionHasErrors('amount');
    }

    public function test_member_payment_withholds_penalties_and_respects_remaining(): void
    {
        $late = $this->task(['due_date' => '2026-06-07']); // 3 days late -> 2 penalties = 20 000
        PenaltyService::accrue($late);
        $this->assertSame(20000, $this->member->penaltyDebt());

        $this->actingAs($this->admin);
        $this->post("/tasks/{$late->id}/payments", ['amount' => 60_000, 'method' => 'cash'])->assertSessionHasErrors('amount');
        $this->post("/tasks/{$late->id}/payments", ['amount' => 15_000, 'method' => 'cash'])->assertSessionHasNoErrors();
        $p = $late->payments()->first();
        $this->assertSame([15000, 15000, 0], [$p->gross_amount, $p->penalty_deducted, $p->net_amount]);
        $this->assertSame(5000, $this->member->penaltyDebt());

        $this->post("/tasks/{$late->id}/payments", ['amount' => 35_000, 'method' => 'mobile_money'])->assertSessionHasNoErrors();
        $p2 = $late->payments()->latest('id')->first();
        $this->assertSame([5000, 30000], [$p2->penalty_deducted, $p2->net_amount]);
        $this->assertSame(0, $late->fresh()->remainingFee());
        $this->assertSame(0, $this->member->penaltyDebt());

        $this->actingAs($this->member)->get("/member-payments/{$p2->id}/receipt")->assertOk();
    }

    public function test_direct_penalty_collection_by_assistant_capped_at_debt(): void
    {
        PenaltyService::accrue($this->task(['due_date' => '2026-06-09']));
        $this->actingAs($this->assistant);
        $this->post('/penalties/collect', ['user_id' => $this->member->id, 'amount' => 20000])->assertSessionHasErrors('amount');
        $this->post('/penalties/collect', ['user_id' => $this->member->id, 'amount' => 4000, 'method' => 'cash'])->assertSessionHasNoErrors();
        $this->assertSame(6000, $this->member->penaltyDebt());
        $this->get('/penalties')->assertOk();
        $this->assertSame(1, $this->admin->notifications()->where('data->kind', 'penalty_collected')->count());
    }

    public function test_pages_render_for_each_role(): void
    {
        $this->task();
        foreach (['/', '/projects', "/projects/{$this->project->id}", '/tasks', '/clients', '/finances', '/team', '/settings', '/activity-log', '/penalties', '/notifications', '/me/earnings'] as $url) {
            $this->actingAs($this->admin)->get($url)->assertOk();
        }
        foreach (['/', '/projects', '/tasks', '/penalties', '/me/earnings'] as $url) {
            $this->actingAs($this->assistant)->get($url)->assertOk();
        }
        foreach (['/', '/tasks', '/me/earnings', '/notifications'] as $url) {
            $this->actingAs($this->member)->get($url)->assertOk();
        }
        $this->get('/finances/export/projets')->assertForbidden();
        $this->actingAs($this->admin)->get('/finances/export/projets')->assertOk();
    }

    public function test_admin_can_cancel_penalties_with_reason(): void
    {
        $task = $this->task(['due_date' => '2026-06-07']); // 3 days late -> 2 penalties
        PenaltyService::accrue($task);
        $ids = $task->penalties()->pluck('id')->all();
        $this->assertSame(20000, $this->member->penaltyDebt());

        // Assistant cannot cancel; reason is mandatory.
        $this->actingAs($this->assistant)->post('/penalties/cancel', ['penalty_ids' => $ids, 'reason' => 'x'])->assertForbidden();
        $this->actingAs($this->admin)->post('/penalties/cancel', ['penalty_ids' => $ids, 'reason' => ''])->assertSessionHasErrors('reason');

        $this->post('/penalties/cancel', ['penalty_ids' => [$ids[0]], 'reason' => 'Musique reçue en retard du client'])->assertSessionHasNoErrors();
        $this->assertSame(10000, $this->member->penaltyDebt());
        $cancelled = Penalty::find($ids[0]);
        $this->assertNotNull($cancelled->cancelled_at);
        $this->assertSame($this->admin->id, $cancelled->cancelled_by);
        $this->assertSame(2, $task->penalties()->count(), 'kept in history');

        // A cancelled period is never re-counted.
        $this->assertSame(0, PenaltyService::accrue($task->fresh()));
        $this->assertSame(10000, $this->member->penaltyDebt());

        // Already cancelled -> nothing to do.
        $this->post('/penalties/cancel', ['penalty_ids' => [$ids[0]], 'reason' => 'encore'])->assertSessionHasErrors('penalty_ids');

        // Settled penalty: cancelling it requires refunding the member.
        $this->post('/penalties/collect', ['user_id' => $this->member->id, 'amount' => 10000]);
        $this->assertSame(0, $this->member->penaltyDebt());
        $this->post('/penalties/cancel', ['penalty_ids' => [$ids[1]], 'reason' => 'Erreur du studio'])->assertSessionHasErrors('refund_method');
        $this->assertNull(Penalty::find($ids[1])->cancelled_at, 'nothing cancelled without refund');

        $marginBefore = FinanceService::summary()['margin'];
        $this->post('/penalties/cancel', ['penalty_ids' => [$ids[1]], 'reason' => 'Erreur du studio', 'refund_method' => 'mobile_money', 'refund_reference' => 'MP123'])->assertSessionHasNoErrors();
        $refund = PenaltyRefund::sole();
        $this->assertSame([10000, 'FST-RB-2026-00001', $task->id, $this->project->id], [$refund->amount, $refund->receipt_number, $refund->task_id, $refund->project_id]);
        $this->assertSame(0, $this->member->penaltyDebt(), 'debt never goes negative');
        $this->assertSame($marginBefore - 10000, FinanceService::summary()['margin']);
        $this->assertSame(-10000, $this->project->financials()['margin']);
        $this->get("/penalty-refunds/{$refund->id}/receipt")->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->actingAs($this->member)->get("/penalty-refunds/{$refund->id}/receipt")->assertOk();
        $this->actingAs($this->assistant)->get("/penalty-refunds/{$refund->id}/receipt")->assertForbidden();
        $this->actingAs($this->admin);

        $this->assertSame(2, $this->member->notifications()->where('data->kind', 'penalty_cancelled')->count());
        $this->get("/tasks/{$task->id}")->assertInertia(fn ($p) => $p->where('task.penalties.0.cancel_reason', 'Musique reçue en retard du client'));
        $this->get('/penalties')->assertOk()->assertInertia(fn ($p) => $p->has('cancellations', 2)->has('refunds', 1)->where('members.0.debt', 0)->where('members.0.refunded', 10000));
        $this->actingAs($this->member)->get('/me/earnings')->assertInertia(fn ($p) => $p->has('refunds', 1)->where('summary.penalty_debt', 0));
    }

    public function test_templates_are_hidden_by_default(): void
    {
        $this->actingAs($this->admin)->get('/templates')->assertNotFound();
        $this->post("/projects/{$this->project->id}/apply-template", [])->assertNotFound();
        $this->get("/projects/{$this->project->id}")->assertInertia(fn ($p) => $p->where('templates', [])->where('features.templates', false));
    }

    public function test_new_member_password_is_given_once_for_copy(): void
    {
        $this->actingAs($this->admin)->post('/team', ['name' => 'Nina Kamga', 'email' => 'nina@example.com', 'phone' => '690000000', 'role' => 'photographe'])
            ->assertSessionHas('credentials', fn ($c) => $c['name'] === 'Nina Kamga' && strlen($c['password']) >= 8 && $c['new'] === true);
        $nina = User::where('email', 'nina@example.com')->firstOrFail();
        $this->post("/team/{$nina->id}/reset-password")->assertSessionHas('credentials', fn ($c) => $c['new'] === false);
        $this->assertStringNotContainsString(session('credentials')['password'], (string) session('success'));
    }

    public function test_template_applies_tasks_with_chain_shares_and_least_busy_people(): void
    {
        config(['studio.templates' => true]);
        $editor = User::factory()->role(Role::Monteur)->create(['name' => 'Eric']);
        $busy = User::factory()->role(Role::Photographe)->create(['name' => 'Busy']);
        $this->task(['assigned_to' => $busy->id]); // Busy already has work, $this->member has none
        $this->project->update(['event_date' => '2026-06-15']);
        $tpl = ProjectTemplate::where('name', 'Séance photo (portrait, studio)')->firstOrFail();

        $this->actingAs($this->admin)->get("/projects/{$this->project->id}")->assertInertia(fn ($p) => $p
            ->where('templates.'.ProjectTemplate::orderBy('name')->pluck('id')->search($tpl->id).'.tasks.0.assigned_to', $this->member->id)
            ->where('templates.'.ProjectTemplate::orderBy('name')->pluck('id')->search($tpl->id).'.tasks.0.due_date', '2026-06-15'));

        // Missing assignee is refused.
        $this->post("/projects/{$this->project->id}/apply-template", ['template_id' => $tpl->id, 'rows' => [
            ['key' => 'seance', 'include' => true, 'assigned_to' => null], ['key' => 'retouche', 'include' => true, 'assigned_to' => $editor->id],
        ]])->assertSessionHasErrors('rows.seance.assigned_to');

        $this->post("/projects/{$this->project->id}/apply-template", ['template_id' => $tpl->id, 'rows' => [
            ['key' => 'seance', 'include' => true, 'assigned_to' => $this->member->id, 'due_date' => '2026-06-15'],
            ['key' => 'retouche', 'include' => true, 'assigned_to' => $editor->id, 'due_date' => '2026-06-29'],
        ]])->assertSessionHasNoErrors();

        $seance = Task::where('name', 'Séance photo')->firstOrFail();
        $retouche = Task::where('name', 'Retouche des photos choisies')->firstOrFail();
        $this->assertSame($seance->id, $retouche->depends_on_id);
        $this->assertTrue($retouche->isWaiting());
        $this->assertSame(600000, $seance->client_share); // 60 % of 1 000 001
        $this->assertSame('2026-06-29', $retouche->due_date->toDateString());
        $this->assertSame(1, $editor->notifications()->count());

        // Applying it again would exceed the project price.
        $this->post("/projects/{$this->project->id}/apply-template", ['template_id' => $tpl->id, 'rows' => [
            ['key' => 'seance', 'assigned_to' => $this->member->id], ['key' => 'retouche', 'assigned_to' => $editor->id],
        ]])->assertSessionHasErrors('rows');
        // ...unless the admin chooses to leave the shares for later.
        $this->post("/projects/{$this->project->id}/apply-template", ['template_id' => $tpl->id, 'skip_shares' => true, 'rows' => [
            ['key' => 'seance', 'assigned_to' => $this->member->id], ['key' => 'retouche', 'assigned_to' => $editor->id],
        ]])->assertSessionHasNoErrors();
        $this->assertSame(0, (int) Task::where('name', 'Séance photo')->orderByDesc('id')->value('client_share'));
    }

    public function test_skipped_template_step_relinks_to_the_previous_one(): void
    {
        config(['studio.templates' => true]);
        $tpl = ProjectTemplate::where('name', 'Mariage (photo + vidéo)')->firstOrFail();
        $editor = User::factory()->role(Role::Monteur)->create();
        $video = User::factory()->role(Role::Videaste)->create();
        $rows = collect($tpl->tasks())->map(fn ($t) => [
            'key' => $t['key'], 'include' => $t['key'] !== 'tri',
            'assigned_to' => ['monteur' => $editor->id, 'videaste' => $video->id][$t['role']] ?? $this->member->id,
        ])->all();
        $this->actingAs($this->admin)->post("/projects/{$this->project->id}/apply-template", ['template_id' => $tpl->id, 'rows' => $rows])->assertSessionHasNoErrors();

        $this->assertSame(0, Task::where('name', 'Tri et sélection des photos')->count());
        $photo = Task::where('name', 'Couverture photo du mariage')->firstOrFail();
        $this->assertSame($photo->id, Task::where('name', 'Retouche des photos sélectionnées')->value('depends_on_id'));
        // Existing "Shooting" activity is reused, not duplicated.
        $this->assertSame(1, $this->project->activities()->where('name', 'Shooting')->count());
    }

    public function test_save_project_as_template_and_editor_rejects_cycles(): void
    {
        config(['studio.templates' => true]);
        $first = $this->task(['name' => 'Shooting', 'due_date' => '2026-06-20', 'client_share' => 300_000]);
        $this->task(['name' => 'Retouche', 'due_date' => '2026-06-28', 'depends_on_id' => $first->id]);

        $this->actingAs($this->admin)->post("/projects/{$this->project->id}/save-as-template", ['name' => 'Mon mariage'])->assertSessionHasNoErrors();
        $tpl = ProjectTemplate::where('name', 'Mon mariage')->firstOrFail();
        $tasks = collect($tpl->tasks())->keyBy('name');
        $this->assertSame($tasks['Shooting']['key'], $tasks['Retouche']['after']);
        $this->assertSame(['delivery', 2, 30], [$tasks['Retouche']['from'], $tasks['Retouche']['days'], $tasks['Shooting']['client_pct']]);
        $this->assertSame('photographe', $tasks['Shooting']['role']);

        $structure = ['activities' => [['name' => 'A', 'tasks' => [
            ['key' => 'a', 'name' => 'A', 'from' => 'event', 'days' => 0, 'after' => 'b'],
            ['key' => 'b', 'name' => 'B', 'from' => 'event', 'days' => 1, 'after' => 'a'],
        ]]]];
        $this->put("/templates/{$tpl->id}", ['name' => 'X', 'structure' => $structure])->assertSessionHasErrors('activities');
        $this->actingAs($this->assistant)->get('/templates')->assertForbidden();
    }
}
