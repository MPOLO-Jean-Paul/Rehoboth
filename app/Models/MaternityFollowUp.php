<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaternityFollowUp extends Model
{
    protected $fillable = [
        'maternity_case_id',
        'user_id',
        'type',
        'maternal_bp',
        'fetal_heart_rate',
        'cervical_dilation',
        'contractions',
        'baby_weight',
        'temperature',
        'notes',
        'next_action',
        'next_check_at',
    ];

    protected $casts = [
        'cervical_dilation' => 'decimal:1',
        'baby_weight' => 'decimal:2',
        'temperature' => 'decimal:1',
        'next_check_at' => 'datetime',
    ];

    public function maternityCase()
    {
        return $this->belongsTo(MaternityCase::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
