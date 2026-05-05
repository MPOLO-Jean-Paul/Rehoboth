<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Prescription extends Model
{
    protected $fillable = ['visit_id', 'patient_id', 'doctor_id', 'notes', 'status'];

    public function items()
    {
        return $this->hasMany(PrescriptionItem::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function visit()
    {
        return $this->belongsTo(Visit::class);
    }
}
