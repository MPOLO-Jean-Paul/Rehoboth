<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'postname',
        'phone',
        'email',
        'password',
        'role',
        'specialty',
        'expo_push_token',
        'profile_picture',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = ['profile_photo'];

    public function getProfilePhotoAttribute()
    {
        if (!$this->profile_picture) return null;

        return route('media.public', ['path' => $this->profile_picture]);
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function maternityCasesAsMidwife()
    {
        return $this->hasMany(MaternityCase::class, 'midwife_id');
    }

    public function maternityCasesAsDoctor()
    {
        return $this->hasMany(MaternityCase::class, 'doctor_id');
    }
}
