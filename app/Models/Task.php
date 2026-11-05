<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $name
 * @property TaskStatus $status
 * @property CarbonImmutable $due_date
 * @property int $member_fee
 * @property int $client_share
 * @property int|null $assigned_to
 * @property User|null $assignee
 * @property Project $project
 * @property Activity $activity
 */
class Task extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected $attributes = [
        'status' => 'todo',
        'client_share' => 0,
        'member_fee' => 0,
        'penalty_periods' => 0,
        'penalty_base' => 0,
        'penalty_immediate' => true,
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'penalty_anchor' => 'date',
            'penalty_immediate' => 'boolean',
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'validated_at' => 'datetime',
            'reminded_at' => 'datetime',
            'overdue_notified_at' => 'datetime',
            'status' => TaskStatus::class,
            'member_fee' => 'integer',
            'client_share' => 'integer',
        ];
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class)->withTrashed();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to')->withTrashed();
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by')->withTrashed();
    }

    /** The task that must be validated before this one can start (archived = no longer blocks). */
    public function dependency(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'depends_on_id');
    }

    public function dependents(): HasMany
    {
        return $this->hasMany(Task::class, 'depends_on_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(TaskReview::class)->latest('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(MemberPayment::class);
    }

    public function penalties(): HasMany
    {
        return $this->hasMany(Penalty::class);
    }

    public function activePenalties(): HasMany
    {
        return $this->hasMany(Penalty::class)->whereNull('cancelled_at');
    }

    public function isLocked(): bool
    {
        return $this->status === TaskStatus::Done;
    }

    /** Waiting for the previous task: the member cannot start, and no penalty runs. */
    public function isWaiting(): bool
    {
        if (! $this->depends_on_id || ! $this->status->isOpen()) {
            return false;
        }
        $dep = $this->dependency;

        return $dep !== null && $dep->status !== TaskStatus::Done;
    }

    public function isLate(): bool
    {
        return $this->status->isOpen() && $this->due_date->lt(CarbonImmutable::today()) && ! $this->isWaiting();
    }

    /** @param Builder<Task> $q */
    public function scopeOpen(Builder $q): void
    {
        $q->whereIn('status', TaskStatus::open());
    }

    /** @param Builder<Task> $q */
    public function scopeWaiting(Builder $q): void
    {
        $q->open()->whereHas('dependency', fn ($d) => $d->where('status', '!=', TaskStatus::Done->value));
    }

    /** Open and not waiting: the member can (and should) work on it. @param Builder<Task> $q */
    public function scopeActionable(Builder $q): void
    {
        $q->open()->whereDoesntHave('dependency', fn ($d) => $d->where('status', '!=', TaskStatus::Done->value));
    }

    /** @param Builder<Task> $q */
    public function scopeLate(Builder $q): void
    {
        $q->actionable()->whereDate('due_date', '<', CarbonImmutable::today()->toDateString());
    }

    public function paidGross(): int
    {
        return (int) $this->payments()->sum('gross_amount');
    }

    public function remainingFee(): int
    {
        return max(0, $this->member_fee - $this->paidGross());
    }
}
