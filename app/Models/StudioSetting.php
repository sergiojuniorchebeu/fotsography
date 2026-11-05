<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * @property string $studio_name
 * @property string $receipt_prefix
 * @property int $plan_advance_pct
 * @property int $plan_intermediate_pct
 * @property int $plan_balance_pct
 * @property int $task_delivery_offset_days
 * @property bool $penalties_enabled
 * @property int $penalty_amount
 * @property int $penalty_interval_days
 * @property string|null $logo_path
 */
class StudioSetting extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'penalties_enabled' => 'boolean',
            'penalty_amount' => 'integer',
            'penalty_interval_days' => 'integer',
            'task_delivery_offset_days' => 'integer',
            'plan_advance_pct' => 'integer',
            'plan_intermediate_pct' => 'integer',
            'plan_balance_pct' => 'integer',
        ];
    }

    protected static ?self $cached = null;

    public static function current(): self
    {
        if (static::$cached === null || ! static::$cached->exists) {
            static::$cached = static::query()->first() ?? static::query()->create([]);
            static::$cached->refresh();
        }

        return static::$cached;
    }

    public static function flush(): void
    {
        static::$cached = null;
    }

    public function logoUrl(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null;
    }

    public function logoAbsolutePath(): ?string
    {
        return $this->logo_path ? Storage::disk('public')->path($this->logo_path) : null;
    }
}
