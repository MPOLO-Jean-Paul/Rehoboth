<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffMessage extends Model
{
    protected $fillable = ['sender_id', 'subject', 'message', 'is_read'];

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
