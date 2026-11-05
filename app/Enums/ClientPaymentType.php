<?php

namespace App\Enums;

enum ClientPaymentType: string
{
    case Advance = 'advance';
    case Intermediate = 'intermediate';
    case Balance = 'balance';
    case Free = 'free';

    public function label(): string
    {
        return match ($this) {
            self::Advance => 'Avance',
            self::Intermediate => 'Intermédiaire',
            self::Balance => 'Solde',
            self::Free => 'Versement libre',
        };
    }
}
