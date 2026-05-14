<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    protected $fillable = [
        'first_name', 'last_name', 'post_name', 'is_insured', 'insurance_company',
        'insurance_code', 'contact_info', 'complaints', 'insurance_id', 'birth_year', 
        'pathology', 'gender', 'status', 'death_date', 'discharge_type', 'medical_history_summary'
    ];

    protected $casts = [
        'is_insured' => 'boolean',
        'death_date' => 'date',
    ];

    protected $appends = ['age', 'is_deceased'];

    public function getIsDeceasedAttribute()
    {
        return $this->status === 'deceased';
    }

    public function getAgeAttribute()
    {
        return $this->birth_year ? (now()->year - (int)$this->birth_year) : null;
    }

    public function insurance()
    {
        return $this->belongsTo(Insurance::class);
    }

    public function visits()
    {
        return $this->hasMany(Visit::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function maternityCases()
    {
        return $this->hasMany(MaternityCase::class);
    }
}
