<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = ['key', 'value'];

    private static array $runtimeCache = [];

    public static function getValue($key, $default = null)
    {
        if (array_key_exists($key, self::$runtimeCache)) {
            return self::$runtimeCache[$key] ?? $default;
        }

        $value = self::where('key', $key)->value('value');
        self::$runtimeCache[$key] = $value;

        return $value ?? $default;
    }

    public static function setValue($key, $value)
    {
        self::$runtimeCache[$key] = $value;

        return self::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
