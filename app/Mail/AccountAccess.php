<?php

namespace App\Mail;

use App\Models\StudioSetting;
use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Login details for a new account, or after an admin reset the password. Sent right away (not queued). */
class AccountAccess extends Mailable
{
    public function __construct(public User $user, public string $password, public bool $isNew) {}

    public function envelope(): Envelope
    {
        $studio = StudioSetting::current()->studio_name ?: config('app.name');

        return new Envelope(subject: $this->isNew ? "Vos accès à {$studio}" : "Votre nouveau mot de passe {$studio}");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.account-access', with: [
            'studio' => StudioSetting::current()->studio_name ?: config('app.name'),
            'loginUrl' => url('/login'),
        ]);
    }
}
