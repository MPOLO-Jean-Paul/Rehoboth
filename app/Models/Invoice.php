<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $fillable = [
        'visit_id',
        'patient_id',
        'amount',
        'status',
        'details',
        'service',
        'item_count',
        'metadata',
        'payment_method',
        'payment_phone',
        'payment_reference',
        'payment_currency',
        'payment_status',
        'insurance_id',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function visit()
    {
        return $this->belongsTo(Visit::class);
    }

    public function insurance()
    {
        return $this->belongsTo(Insurance::class);
    }
}
