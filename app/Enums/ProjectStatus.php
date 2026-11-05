<?php

namespace App\Enums;

enum ProjectStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Brouillon',
            self::InProgress => 'En cours',
            self::Delivered => 'Livré',
            self::Cancelled => 'Annulé',
        };
    }

    /** @return array<int, array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(fn (self $r) => ['value' => $r->value, 'label' => $r->label()], self::cases());
    }
}
