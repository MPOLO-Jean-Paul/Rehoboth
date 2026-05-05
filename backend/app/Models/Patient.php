<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    protected $fillable = [
        'first_name', 'last_name', 'is_insured', 'insurance_company',
        'insurance_code', 'contact_info', 'complaints'
    ];

    protected $casts = [
        'is_insured' => 'boolean',
    ];

    public function visits()
    {
        return $this->hasMany(Visit::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
