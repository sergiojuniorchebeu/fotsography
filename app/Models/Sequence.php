<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Sequence extends Model
{
    public $timestamps = false;

    protected $guarded = [];

    /** Build the next document number, e.g. FST-2026-00001 / FST-R-2026-00001. */
    public static function nextNumber(string $key, ?string $infix = null): string
    {
        $year = (int) now()->format('Y');

        $value = DB::transaction(function () use ($key, $year) {
            $row = static::query()->where('key', $key)->where('year', $year)->lockForUpdate()->first();
            if (! $row) {
                $row = static::query()->create(['key' => $key, 'year' => $year, 'value' => 0]);
            }
            $row->increment('value');

            return (int) $row->value;
        });

        $prefix = StudioSetting::current()->receipt_prefix ?: 'FST';

        return implode('-', array_filter([$prefix, $infix, $year, str_pad((string) $value, 5, '0', STR_PAD_LEFT)]));
    }
}
