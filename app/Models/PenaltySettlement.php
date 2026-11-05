<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PenaltySettlement extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['settled_at' => 'datetime', 'amount' => 'integer'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by')->withTrashed();
    }

    public function memberPayment(): BelongsTo
    {
        return $this->belongsTo(MemberPayment::class);
    }
}
