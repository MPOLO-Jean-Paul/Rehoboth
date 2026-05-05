<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hospitalization extends Model
{
    protected $fillable = [
        'patient_id',
        'visit_id',
        'room_number',
        'bed_number',
        'ward',
        'status',
        'admission_date',
        'discharge_date',
        'daily_rate',
        'diagnosis',
        'notes',
        'attending_doctor_id',
        'last_billed_at',
        'last_checked_at',
        'alert_active',
        'alert_reason',
    ];

    protected $casts = [
        'admission_date' => 'date',
        'discharge_date' => 'date',
        'last_billed_at' => 'datetime',
        'last_checked_at' => 'datetime',
        'alert_active' => 'boolean',
        'daily_rate' => 'decimal:2',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function visit()
    {
        return $this->belongsTo(Visit::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'attending_doctor_id');
    }

    // Nombre de jours d'hospitalisation
    public function getDaysCountAttribute(): int
    {
        $end = $this->discharge_date ?? now()->toDateString();
        return $this->admission_date->diffInDays($end) + 1;
    }

    // Montant total dû
    public function getTotalAmountAttribute(): float
    {
        return $this->days_count * (float) $this->daily_rate;
    }
}
