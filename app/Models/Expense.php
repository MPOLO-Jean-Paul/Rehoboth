<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'category',
        'amount',
        'description',
        'payment_method',
        'expense_date',
        'recorded_by'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
