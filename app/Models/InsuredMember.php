<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InsuredMember extends Model
{
    protected $fillable = ['insurance_id', 'member_name', 'membership_code', 'is_active'];

    public function insurance()
    {
        return $this->belongsTo(Insurance::class);
    }
}
