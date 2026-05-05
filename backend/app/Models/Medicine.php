<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Medicine extends Model
{
    protected $fillable = [
        'name', 'description', 'dosage', 'unit', 
        'stock_quantity', 'low_stock_threshold', 
        'price', 'expiry_date'
    ];

    public function movements()
    {
        return $this->hasMany(StockMovement::class);
    }
}
