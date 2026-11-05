<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A counted late penalty. Never deleted: an admin may cancel it (with a reason),
 * which keeps it in the history but removes it from the member's debt.
 */
class Penalty extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['accrued_at' => 'datetime', 'cancelled_at' => 'datetime', 'amount' => 'integer'];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by')->withTrashed();
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }

    /** @param Builder<self> $query */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('cancelled_at');
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'period' => $this->period,
            'amount' => $this->amount,
            'days_late' => $this->days_late,
            'accrued_at' => $this->accrued_at->toIso8601String(),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'cancelled_by' => $this->canceller?->name,
        ];
    }
}
