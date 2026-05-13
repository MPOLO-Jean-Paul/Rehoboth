<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaternityCase extends Model
{
    protected $fillable = [
        'patient_id',
        'visit_id',
        'status',
        'pregnancy_status',
        'gravida',
        'parity',
        'gestational_age_weeks',
        'last_menstrual_period',
        'expected_delivery_date',
        'admission_date',
        'delivery_date',
        'discharge_date',
        'risk_level',
        'risk_notes',
        'delivery_type',
        'baby_gender',
        'baby_weight',
        'baby_apgar',
        'fetal_heart_rate',
        'maternal_bp',
        'temperature',
        'notes',
        'midwife_id',
        'doctor_id',
        'last_checked_at',
        'alert_active',
        'alert_reason',
    ];

    protected $casts = [
        'last_menstrual_period' => 'date',
        'expected_delivery_date' => 'date',
        'admission_date' => 'datetime',
        'delivery_date' => 'datetime',
        'discharge_date' => 'datetime',
        'last_checked_at' => 'datetime',
        'alert_active' => 'boolean',
        'baby_weight' => 'decimal:2',
        'temperature' => 'decimal:1',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function visit()
    {
        return $this->belongsTo(Visit::class);
    }

    public function midwife()
    {
        return $this->belongsTo(User::class, 'midwife_id');
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function followUps()
    {
        return $this->hasMany(MaternityFollowUp::class);
    }
}
