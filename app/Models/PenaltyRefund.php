<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Money paid back to a member when an admin cancels penalties that had already been settled.
 */
class PenaltyRefund extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['refunded_at' => 'datetime', 'amount' => 'integer', 'method' => PaymentMethod::class];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class)->withTrashed();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class)->withTrashed();
    }

    public function refunder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'refunded_by')->withTrashed();
    }

    /** @return array<string, mixed> */
    public function toRow(): array
    {
        return [
            'id' => $this->id,
            'member' => $this->user?->name,
            'amount' => $this->amount,
            'method_label' => $this->method->label(),
            'reference' => $this->reference,
            'reason' => $this->reason,
            'receipt_number' => $this->receipt_number,
            'task' => $this->task ? ['id' => $this->task->id, 'name' => $this->task->name] : null,
            'refunded_by' => $this->refunder?->name,
            'refunded_at' => $this->refunded_at->toIso8601String(),
        ];
    }
}
