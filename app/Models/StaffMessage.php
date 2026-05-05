<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffMessage extends Model
{
    protected $fillable = ['sender_id', 'target_role', 'subject', 'message', 'priority', 'is_read'];

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function reads()
    {
        return $this->hasMany(StaffMessageRead::class);
    }
}
