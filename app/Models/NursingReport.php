<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NursingReport extends Model
{
    protected $fillable = [
        'nurse_id',
        'shift_type',
        'report_date',
        'patients_seen',
        'transfers_done',
        'emergencies_handled',
        'summary',
        'patients_to_watch',
        'incidents',
        'handover_notes',
        'status',
    ];

    protected $casts = [
        'report_date'       => 'date',
        'patients_to_watch' => 'array',
        'incidents'         => 'array',
    ];

    public function nurse()
    {
        return $this->belongsTo(User::class, 'nurse_id');
    }
}
