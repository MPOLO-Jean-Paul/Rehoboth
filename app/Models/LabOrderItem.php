<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabOrderItem extends Model
{
    protected $fillable = [
        'lab_order_id', 'test_name', 'category', 
        'result', 'reference_range', 'unit', 'status'
    ];

    public function labOrder()
    {
        return $this->belongsTo(LabOrder::class);
    }
}
