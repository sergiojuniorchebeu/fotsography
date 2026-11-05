<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskReview extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
