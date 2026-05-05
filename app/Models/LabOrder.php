<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabOrder extends Model
{
    protected $fillable = ['visit_id', 'patient_id', 'doctor_id', 'clinical_notes', 'status'];

    public function items()
    {
        return $this->hasMany(LabOrderItem::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }
}
