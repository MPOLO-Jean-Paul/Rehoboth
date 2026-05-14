<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Insurance extends Model
{
    protected $fillable = ['name', 'email', 'status', 'contract_date', 'contract_end_date', 'contract_type', 'monthly_flat_fee', 'contact_info'];

    protected $casts = [
        'contract_date' => 'date',
        'contract_end_date' => 'date',
        'monthly_flat_fee' => 'decimal:2',
    ];

    protected $appends = ['is_expired', 'is_operational', 'days_until_expiry'];

    public function getIsExpiredAttribute(): bool
    {
        return $this->contract_end_date !== null && $this->contract_end_date->endOfDay()->isPast();
    }

    public function getIsOperationalAttribute(): bool
    {
        return $this->status === 'active' && !$this->is_expired;
    }

    public function getDaysUntilExpiryAttribute(): ?int
    {
        if (!$this->contract_end_date) {
            return null;
        }

        return now()->startOfDay()->diffInDays($this->contract_end_date->startOfDay(), false);
    }

    public function markExpiredIfNeeded(): bool
    {
        if ($this->status === 'active' && $this->is_expired) {
            $this->forceFill(['status' => 'expired'])->save();
            return true;
        }

        return false;
    }

    public static function syncExpiredContracts(): int
    {
        return static::where('status', 'active')
            ->whereNotNull('contract_end_date')
            ->whereDate('contract_end_date', '<', now()->toDateString())
            ->update(['status' => 'expired']);
    }

    public function insuredMembers()
    {
        return $this->hasMany(InsuredMember::class);
    }

    public function patients()
    {
        return $this->hasMany(Patient::class);
    }
}
