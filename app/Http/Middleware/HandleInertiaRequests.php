<?php

namespace App\Http\Middleware;

use App\Models\StudioSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /** @return array<string, mixed> */
    public function share(Request $request): array
    {
        $user = $request->user();
        $settings = Schema::hasTable('studio_settings') ? StudioSetting::current() : null;

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'studio' => $settings ? [
                'name' => $settings->studio_name,
                'logo' => $settings->logoUrl(),
            ] : null,
            'auth' => [
                'user' => $user ? [
                    ...$user->toPublic(),
                    'is_admin' => $user->isAdmin(),
                    'is_staff' => $user->isStaff(),
                    'must_change_password' => $user->must_change_password,
                ] : null,
            ],
            'unreadNotifications' => fn () => $user ? $user->unreadNotifications()->count() : 0,
            'vapidPublicKey' => config('webpush.vapid.public_key'),
            'features' => ['templates' => (bool) config('studio.templates')],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'credentials' => fn () => $request->session()->get('credentials'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
