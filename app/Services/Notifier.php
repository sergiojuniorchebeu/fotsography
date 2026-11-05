<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\StudioNotification;
use Illuminate\Support\Facades\Log;
use Throwable;

class Notifier
{
    public static function send(?User $user, string $kind, string $title, string $body, ?string $url = null): void
    {
        if (! $user || ! $user->is_active) {
            return;
        }
        try {
            $user->notify(new StudioNotification($kind, $title, $body, $url));
        } catch (Throwable $e) {
            // A failing push must never break a business action.
            Log::warning('Notification failed: '.$e->getMessage());
        }
    }

    public static function admins(string $kind, string $title, string $body, ?string $url = null, ?User $except = null): void
    {
        foreach (User::admins() as $admin) {
            if ($except && $admin->id === $except->id) {
                continue;
            }
            self::send($admin, $kind, $title, $body, $url);
        }
    }
}
