<?php

namespace App\Models;

use App\Enums\Role;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use NotificationChannels\WebPush\HasPushSubscriptions;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Role $role
 * @property bool $is_active
 * @property bool $must_change_password
 */
class User extends Authenticatable
{
    use HasFactory, HasPushSubscriptions, Notifiable, SoftDeletes;

    protected $fillable = ['name', 'email', 'phone', 'role', 'password', 'is_active', 'must_change_password', 'last_login_at'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'is_active' => 'boolean',
            'must_change_password' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function isAssistant(): bool
    {
        return $this->role === Role::Assistant;
    }

    public function isStaff(): bool
    {
        return $this->isAdmin() || $this->isAssistant();
    }

    public function isMember(): bool
    {
        return $this->role->isMember();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assigned_to');
    }

    public function penalties(): HasMany
    {
        return $this->hasMany(Penalty::class);
    }

    /** Penalties that still count (not cancelled by an admin). */
    public function activePenalties(): HasMany
    {
        return $this->hasMany(Penalty::class)->whereNull('cancelled_at');
    }

    public function penaltySettlements(): HasMany
    {
        return $this->hasMany(PenaltySettlement::class);
    }

    public function penaltyRefunds(): HasMany
    {
        return $this->hasMany(PenaltyRefund::class);
    }

    public function memberPayments(): HasMany
    {
        return $this->hasMany(MemberPayment::class);
    }

    /**
     * Total penalties still owed by the member (FCFA):
     * active penalties − what was settled (withheld or paid) + what the studio refunded.
     */
    public function penaltyDebt(): int
    {
        return (int) $this->activePenalties()->sum('amount')
            - (int) $this->penaltySettlements()->sum('amount')
            + (int) $this->penaltyRefunds()->sum('amount');
    }

    /** @return array<string, mixed> */
    public function toPublic(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'is_active' => $this->is_active,
        ];
    }

    /** @return Collection<int, self> */
    public static function admins()
    {
        return self::where('role', Role::Admin)->where('is_active', true)->get();
    }
}
