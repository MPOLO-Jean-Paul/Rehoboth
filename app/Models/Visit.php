<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Visit extends Model
{
    protected $fillable = [
        'patient_id',
        'current_service',
        'status',
        'complaints_notes',
        'diagnosis',
        'vitals',
        'nursing_notes',
        'consultation_notes',
        'prescription_notes',
        'prescription_items',
        'lab_tests',
        'lab_results',
        'lab_order_status',
        'pharmacy_order_status',
        'doctor_id',
    ];

    protected $casts = [
        'vitals' => 'array',
        'prescription_items' => 'array',
        'lab_tests' => 'array',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function invoice()
    {
        return $this->hasOne(Invoice::class)->latestOfMany();
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function prescriptions()
    {
        return $this->hasMany(Prescription::class);
    }

    public function labOrders()
    {
        return $this->hasMany(LabOrder::class);
    }
}
