<?php

namespace App\Enums;

enum TaskStatus: string
{
    case Todo = 'todo';
    case InProgress = 'in_progress';
    case Review = 'review';
    case Done = 'done';

    public function label(): string
    {
        return match ($this) {
            self::Todo => 'À faire',
            self::InProgress => 'En cours',
            self::Review => 'À vérifier',
            self::Done => 'Terminée',
        };
    }

    /** Statuses where the work is still in the member's hands (penalties, reminders apply). */
    public static function open(): array
    {
        return [self::Todo->value, self::InProgress->value];
    }

    public function isOpen(): bool
    {
        return $this === self::Todo || $this === self::InProgress;
    }
}
