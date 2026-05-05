<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashierSession extends Model
{
    protected $fillable = [
        'user_id',
        'opening_amount',
        'closing_amount',
        'invoices_count',
        'total_cash',
        'total_mobile',
        'total_insured',
        'status',
        'opened_at',
        'closed_at',
        'reference'
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'opening_amount' => 'decimal:2',
        'closing_amount' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
