<?php

namespace App\Services;

class Money
{
    public static function fcfa(int $amount): string
    {
        return number_format($amount, 0, ',', ' ').' FCFA';
    }
}
