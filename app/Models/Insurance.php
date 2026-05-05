<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Insurance extends Model
{
    protected $fillable = ['name', 'email', 'status', 'contract_date', 'contract_type', 'monthly_flat_fee', 'contact_info'];

    protected $casts = [
        'contract_date' => 'date',
        'monthly_flat_fee' => 'decimal:2',
    ];

    public function insuredMembers()
    {
        return $this->hasMany(InsuredMember::class);
    }

    public function patients()
    {
        return $this->hasMany(Patient::class);
    }
}
