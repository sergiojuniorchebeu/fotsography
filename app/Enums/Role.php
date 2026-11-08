<?php

namespace App\Enums;

enum Role: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Assistant = 'assistant';
    case Photographe = 'photographe';
    case Videaste = 'videaste';
    case Monteur = 'monteur';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin · Développeur',
            self::Admin => 'Administrateur',
            self::Assistant => 'Assistant',
            self::Photographe => 'Photographe',
            self::Videaste => 'Vidéaste',
            self::Monteur => 'Monteur / Retoucheur',
        };
    }

    public function isMember(): bool
    {
        return ! in_array($this, [self::SuperAdmin, self::Admin, self::Assistant], true);
    }

    /** @return array<int, array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(fn (self $r) => ['value' => $r->value, 'label' => $r->label()], array_values(array_filter(self::cases(), fn (self $r) => $r !== self::SuperAdmin)));
    }
}
