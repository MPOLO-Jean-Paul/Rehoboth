<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PrescriptionItem extends Model
{
    protected $fillable = [
        'prescription_id', 'medicine_id', 'medicine_name', 
        'dosage', 'quantity_prescribed', 'quantity_dispensed', 
        'instructions', 'status'
    ];

    public function prescription()
    {
        return $this->belongsTo(Prescription::class);
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
