<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffMessageRead extends Model
{
    protected $fillable = ['staff_message_id', 'user_id', 'read_at', 'deleted_at'];

    protected $casts = [
        'read_at' => 'datetime',
    ];
}
