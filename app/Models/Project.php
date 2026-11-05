<?php

namespace App\Models;

use App\Enums\ClientPaymentType;
use App\Enums\ProjectStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $total_amount
 * @property ProjectStatus $status
 * @property CarbonImmutable $delivery_date
 */
class Project extends Model
{
    use SoftDeletes;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'delivery_date' => 'date',
            'status' => ProjectStatus::class,
            'total_amount' => 'integer',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class)->withTrashed();
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ClientPayment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function memberPayments(): HasMany
    {
        return $this->hasMany(MemberPayment::class);
    }

    public function penaltyRefunds(): HasMany
    {
        return $this->hasMany(PenaltyRefund::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    /**
     * Payment plan in FCFA. Rounding is absorbed by the balance.
     *
     * @return array<string, int>
     */
    public function plan(): array
    {
        $total = $this->total_amount;
        $advance = intdiv($total * $this->advance_pct, 100);
        $intermediate = intdiv($total * $this->intermediate_pct, 100);

        return [
            ClientPaymentType::Advance->value => $advance,
            ClientPaymentType::Intermediate->value => $intermediate,
            ClientPaymentType::Balance->value => $total - $advance - $intermediate,
        ];
    }

    public function paidAmount(): int
    {
        return (int) $this->payments()->sum('amount');
    }

    public function remainingAmount(): int
    {
        return max(0, $this->total_amount - $this->paidAmount());
    }

    /** @return array<string, int> */
    public function financials(): array
    {
        $paid = $this->paidAmount();
        $expenses = (int) $this->expenses()->sum('amount');
        $fees = (int) $this->memberPayments()->sum('net_amount');
        $refunds = (int) $this->penaltyRefunds()->sum('amount');

        return [
            'revenue' => $this->total_amount,
            'collected' => $paid,
            'remaining' => max(0, $this->total_amount - $paid),
            'expenses' => $expenses,
            'fees_paid' => $fees,
            'refunds' => $refunds,
            'fees_planned' => (int) $this->tasks()->sum('member_fee'),
            'client_shares' => (int) $this->tasks()->sum('client_share'),
            'margin' => $paid - $expenses - $fees - $refunds,
        ];
    }
}
